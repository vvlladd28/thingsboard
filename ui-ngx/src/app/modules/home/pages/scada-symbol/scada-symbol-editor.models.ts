///
/// Copyright © 2016-2024 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import { ImageResourceInfo } from '@shared/models/resource.models';
import * as svgjs from '@svgdotjs/svg.js';
import { Box, Element, Rect, Style, SVG, Svg, Timeline } from '@svgdotjs/svg.js';
import { ResizeObserver } from '@juggle/resize-observer';
import { ViewContainerRef } from '@angular/core';
import { forkJoin, from } from 'rxjs';
import {
  setupAddTagPanelTooltip,
  setupTagPanelTooltip
} from '@home/pages/scada-symbol/scada-symbol-tooltip.components';
import {
  ScadaSymbolBehavior,
  ScadaSymbolBehaviorType,
  scadaSymbolContentData,
  ScadaSymbolMetadata,
  ScadaSymbolProperty,
  ScadaSymbolPropertyType
} from '@home/components/widget/lib/scada/scada-symbol.models';
import { TbEditorCompletion, TbEditorCompletions } from '@shared/models/ace/completion.models';
import { CustomTranslatePipe } from '@shared/pipe/custom-translate.pipe';
import { TbHighlightRule } from '@shared/models/ace/ace.models';
import { ValueType } from '@shared/models/constants';
import ITooltipsterInstance = JQueryTooltipster.ITooltipsterInstance;
import TooltipPositioningSide = JQueryTooltipster.TooltipPositioningSide;
import ITooltipsterHelper = JQueryTooltipster.ITooltipsterHelper;
import ITooltipPosition = JQueryTooltipster.ITooltipPosition;

export interface ScadaSymbolData {
  imageResource: ImageResourceInfo;
  scadaSymbolContent: string;
}

export interface ScadaSymbolEditObjectCallbacks {
  tagHasStateRenderFunction: (tag: string) => boolean;
  tagHasClickAction: (tag: string) => boolean;
  editTagStateRenderFunction: (tag: string) => void;
  editTagClickAction: (tag: string) => void;
  tagsUpdated: (tags: string[]) => void;
  hasHiddenElements?: (hasHidden: boolean) => void;
  onSymbolEditObjectDirty: (dirty: boolean) => void;
  onZoom?: () => void;
}

const minSymbolZoom = 0.75;
const maxSymbolZoom = 4;

export class ScadaSymbolEditObject {

  public svgShape: Svg;
  private svgRootNodePart: string;
  private box: Box;
  private elements: ScadaSymbolElement[] = [];
  private readonly shapeResize$: ResizeObserver;
  private performSetup = false;
  private hoverFilterStyle: Style;
  private showHidden = false;
  public scale = 1;

  public tags: string[] = [];

  private zoomFactor = 0.34;

  constructor(private rootElement: HTMLElement,
              public tooltipsContainer: HTMLElement,
              public viewContainerRef: ViewContainerRef,
              private callbacks: ScadaSymbolEditObjectCallbacks,
              public readonly: boolean) {
    this.shapeResize$ = new ResizeObserver(() => {
      this.resize();
    });
  }

  public setReadOnly(readonly: boolean) {
    this.readonly = readonly;
  }

  public setContent(svgContent: string) {
    this.shapeResize$.unobserve(this.rootElement);
    if (this.svgShape) {
      this.destroyElements();
      this.svgShape.remove();
    }
    this.scale = 1;
    this.showHidden = false;
    const contentData = scadaSymbolContentData(svgContent);
    this.svgRootNodePart = contentData.svgRootNode;
    this.svgShape = SVG().svg(contentData.innerSvg);
    this.svgShape.node.style.overflow = 'visible';
    this.svgShape.node.style['user-select'] = 'none';
    const origSvg = SVG(`${contentData.svgRootNode}\n${contentData.innerSvg}\n</svg>`);
    if (origSvg.type === 'svg') {
      this.box = (origSvg as Svg).viewbox();
      if (origSvg.fill()) {
        this.svgShape.fill(origSvg.fill());
      }
    } else {
      this.box = this.svgShape.bbox();
    }
    origSvg.remove();
    this.svgShape.size(this.box.width, this.box.height);
    this.svgShape.viewbox(`0 0 ${this.box.width} ${this.box.height}`);
    this.svgShape.style().attr('tb:inner', true).rule('.tb-element', {cursor: 'pointer', transition: '0.2s filter ease-in-out'});
    this.svgShape.addTo(this.rootElement);
    this.updateHoverFilterStyle();
    this.performSetup = true;
    this.shapeResize$.observe(this.rootElement);
  }

  public getContent(): string {
    if (this.svgShape) {
      this.elements.forEach(e => e.restoreOrigVisibility());
      const svgContent = this.svgShape.svg((e: Element) => {
        if (e.node.hasAttribute('tb:inner')) {
          return false;
        } else {
          e.node.classList.remove('tb-element', 'tooltipstered');
          if (!e.node.classList.length) {
            e.node.removeAttribute('class');
          }
          e.attr('svgjs:data', null);
        }
      }, false);
      this.showHiddenElements(this.showHidden);
      return `${this.svgRootNodePart}\n${svgContent}\n</svg>`;
    } else {
      return null;
    }
  }

  public cancelEdit() {
    this.elements.filter(e => e.isEditing()).forEach(e => e.stopEdit(true));
  }

  public zoomIn() {
    const level = Math.min(Math.pow(1 + this.zoomFactor, 1.2) * this.svgShape.zoom(), maxSymbolZoom);
    this.zoomAnimate(level);
  }

  public zoomOut() {
    const level = Math.max(Math.pow(1 + this.zoomFactor, -1.2) * this.svgShape.zoom(), minSymbolZoom);
    this.zoomAnimate(level);
  }

  public showHiddenElements(show: boolean) {
    this.showHidden = show;
    this.elements.forEach(e => show ? e.showInvisible() : e.hideInvisible());
  }

  private zoomAnimate(level: number, animationMs = 200) {
    if (level !== this.svgShape.zoom()) {
      this.hideTooltips();
      const runner = this.svgShape.animate(animationMs).ease('<>');
      runner
      .zoom(level)
      .during(() => {
        const box = this.restrictToMargins(this.svgShape.viewbox());
        this.svgShape.viewbox(box);
      })
      .after(() => {
        this.postZoom(this.callbacks.onZoom);
      });
    }
  }

  public zoomInDisabled() {
    return Number(this.svgShape.zoom().toFixed(5)) >= maxSymbolZoom;
  }

  public zoomOutDisabled() {
    return Number(this.svgShape.zoom().toFixed(5)) <= minSymbolZoom;
  }

  private doSetup() {
    this.setupZoomPan();
    (window as any).SVG = svgjs;
    forkJoin([
      from(import('tooltipster')),
      from(import('tooltipster/dist/js/plugins/tooltipster/SVG/tooltipster-SVG.min.js'))
    ]).subscribe(() => {
      this.setupElements();
    });
  }

  private setupZoomPan() {
    this.svgShape.panZoom({
      zoomMin: minSymbolZoom,
      zoomMax: maxSymbolZoom,
      zoomFactor: this.zoomFactor
    });
    this.svgShape.on('zoom', (e) => {
      const {
        detail: { level, focus }
      } = e as any;
      this.svgShape.zoom(level, focus);
      this.postZoom(this.callbacks.onZoom, e);
    });
    this.svgShape.on('panning', (e) => {
      const box = (e as any).detail.box;
      this.svgShape.viewbox(this.restrictToMargins(box));
      e.preventDefault();
    });
    this.svgShape.on('panStart', (_e) => {
      this.hideTooltips();
      this.svgShape.node.style.cursor = 'grab';
    });
    this.svgShape.on('panEnd', (_e) => {
      this.restoreTooltips();
      this.svgShape.node.style.cursor = 'default';
    });
    this.svgShape.zoom(minSymbolZoom);
  }

  private postZoom(callback?: () => void, e?: any) {
    const box = this.restrictToMargins(this.svgShape.viewbox());
    this.svgShape.viewbox(box);
    setTimeout(() => {
      this.updateTooltipPositions();
    });
    e?.preventDefault();
    if (callback) {
      callback();
    }
  }

  private restrictToMargins(box: Box): Box {
    const marginX = Math.max(box.width - this.box.width, 0);
    const marginY = Math.max(box.height - this.box.height, 0);
    if (box.x < -marginX) {
      box.x = -marginX;
    } else if ((box.x + box.width) > (this.box.width + marginX)) {
      box.x = this.box.width + marginX - box.width;
    }
    if (box.y < -marginY) {
      box.y = -marginY;
    } else if ((box.y + box.height) > (this.box.height + marginY)) {
      box.y = this.box.height + marginY - box.height;
    }
    return box;
  }

  private setupElements() {
    this.svgShape.children().forEach(child => {
      this.addElement(child);
    });
    const overlappingGroups: ScadaSymbolElement[][] = [];
    for (const el of this.elements) {
      for (const other of this.elements) {
        if (el !== other && el.overlappingCenters(other)) {
          let overlappingGroup: ScadaSymbolElement[];
          for (const list of overlappingGroups) {
            if (list.includes(other) || list.includes(el)) {
              overlappingGroup = list;
              break;
            }
          }
          if (!overlappingGroup) {
            overlappingGroup = [el, other];
            overlappingGroups.push(overlappingGroup);
          } else {
            if (!overlappingGroup.includes(el)) {
              overlappingGroup.push(el);
            } else if (!overlappingGroup.includes(other)){
              overlappingGroup.push(other);
            }
          }
        }
      }
    }
    for (const group of overlappingGroups) {
      const centers = group.map(e => e.box.cy);
      const center = centers.reduce((a, b) => a + b, 0) / centers.length;
      const textElement = group.find(e => e.isText());
      const slots = textElement ? group.length % 2 === 0 ? (group.length + 1) : group.length : group.length;
      if (textElement) {
        textElement.setInnerTooltipOffset(0, center);
        group.splice(group.indexOf(textElement), 1);
      }
      let offset = - (elementTooltipMinHeight * slots) / 2 + elementTooltipMinHeight / 2;
      for (const element of group) {
        if (textElement && offset === 0) {
          offset += elementTooltipMinHeight;
        }
        element.setInnerTooltipOffset(offset, center);
        offset += elementTooltipMinHeight;
      }
    }
    for (const el of this.elements) {
      el.init();
    }
    this.updateTags();
    const hasHidden = this.elements.some(e => e.invisible);
    if (this.callbacks.hasHiddenElements) {
      this.callbacks.hasHiddenElements(hasHidden);
    }
  }

  private addElement(e: Element, parentInvisible = false) {
    if (hasBBox(e)) {
      const invisible = parentInvisible || !e.visible();
      const scadaSymbolElement = new ScadaSymbolElement(this, e, invisible);
      this.elements.push(scadaSymbolElement);
      e.children().forEach(child => {
        if (!(child.type === 'tspan' && e.type === 'text')) {
          this.addElement(child, invisible);
        }
      }, true);
    }
  }

  public destroy() {
    if (this.shapeResize$) {
      this.shapeResize$.disconnect();
    }
    this.destroyElements();
  }

  private destroyElements() {
    this.elements.forEach(e => {
      e.destroy();
    });
    this.elements.length = 0;
  }

  private resize() {
    if (this.svgShape) {
      const targetWidth = this.rootElement.getBoundingClientRect().width;
      const targetHeight = this.rootElement.getBoundingClientRect().height;
      if (targetWidth && targetHeight) {
        const svgAspect = this.box.width / this.box.height;
        const shapeAspect = targetWidth / targetHeight;
        let scale: number;
        if (svgAspect > shapeAspect) {
          scale = targetWidth / this.box.width;
        } else {
          scale = targetHeight / this.box.height;
        }
        if (this.scale !== scale) {
          this.scale = scale;
          this.svgShape.node.style.transform = `scale(${this.scale})`;
          this.updateHoverFilterStyle();
          this.updateTooltipPositions();
        }
        if (this.performSetup) {
          this.performSetup = false;
          this.doSetup();
        }
      }
    }
  }

  private updateHoverFilterStyle() {
    if (this.hoverFilterStyle) {
      this.hoverFilterStyle.remove();
    }
    const whiteBlur = (2.8 / this.scale).toFixed(2);
    const blackBlur = (1.2 / this.scale).toFixed(2);
    this.hoverFilterStyle =
      this.svgShape.style().attr('tb:inner', true).rule('.hovered',
        {
          filter:
            `drop-shadow(0px 0px ${whiteBlur}px white) drop-shadow(0px 0px ${whiteBlur}px white)
             drop-shadow(0px 0px ${whiteBlur}px white) drop-shadow(0px 0px ${whiteBlur}px white)
             drop-shadow(0px 0px ${blackBlur}px black)`
        }
      );
  }

  private updateTooltipPositions() {
    for (const e of this.elements) {
      e.updateTooltipPosition();
    }
  }

  private hideTooltips() {
    for (const e of this.elements) {
      e.hideTooltip();
    }
  }

  private restoreTooltips() {
    for (const e of this.elements) {
      e.restoreTooltip();
    }
  }

  public updateTags() {
    this.tags = this.elements
    .filter(e => e.hasTag())
    .map(e => e.tag)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();
    this.callbacks.tagsUpdated(this.tags);
  }

  public tagHasStateRenderFunction(tag: string): boolean {
    return this.callbacks.tagHasStateRenderFunction(tag);
  }

  public tagHasClickAction(tag: string): boolean {
    return this.callbacks.tagHasClickAction(tag);
  }

  public editTagStateRenderFunction(tag: string) {
    this.callbacks.editTagStateRenderFunction(tag);
  }

  public editTagClickAction(tag: string) {
    this.callbacks.editTagClickAction(tag);
  }

  public setDirty(dirty: boolean) {
    this.callbacks.onSymbolEditObjectDirty(dirty);
  }

}

const hasBBox = (e: Element): boolean => {
  try {
    if (e.bbox) {
      let box = e.bbox();
      if (!box.width && !box.height && !e.visible()) {
          e.show();
          box = e.bbox();
          e.hide();
      }
      return !!box.width || !!box.height;
    } else {
      return false;
    }
  } catch (_e) {
    return false;
  }
};

const elementTooltipMinHeight = 36 + 8;
const elementTooltipMinWidth = 100;

const groupRectStroke = 2;
const groupRectPadding = 2;

export class ScadaSymbolElement {

  private highlightRect: Rect;
  private highlightRectTimeline: Timeline;

  public tooltip: ITooltipsterInstance;

  public tag: string;

  private editing = false;
  private onCancelEdit: () => void;

  private innerTooltipOffset = 0;

  public readonly box: Box;

  private highlighted = false;

  private tooltipMouseX: number;
  private tooltipMouseY: number;

  private origVisibility = true;

  get readonly(): boolean {
    return this.editObject.readonly;
  }

  constructor(private editObject: ScadaSymbolEditObject,
              public element: Element,
              public invisible = false) {
    this.tag = element.attr('tb:tag');
    this.origVisibility = element.visible();
    if (this.invisible) {
      element.show();
    }
    this.box = element.rbox(this.editObject.svgShape);
/*    if (element.visible()) {
      this.box = element.rbox(this.editObject.svgShape);
      if (parentGroup && parentGroup.invisible) {
        this.invisible = true;
      }
    } else {
      element.show();
      this.box = element.rbox(this.editObject.svgShape);
      element.hide();
      this.invisible = true;
    }*/
  }

  public init() {
    if (this.isGroup()) {
      this.highlightRect =
        this.editObject.svgShape
        .rect(this.box.width + groupRectPadding * 2, this.box.height + groupRectPadding * 2)
        .x(this.box.x - groupRectPadding)
        .y(this.box.y - groupRectPadding)
        .attr({
          'tb:inner': true,
          fill: 'none',
          rx: this.unscaled(6),
          stroke: 'rgba(0, 0, 0, 0.38)',
          'stroke-dasharray': '1',
          'stroke-width': this.unscaled(groupRectStroke),
          opacity: 0});
      this.highlightRectTimeline = new Timeline();
      this.highlightRect.timeline(this.highlightRectTimeline);
      this.highlightRect.hide();
    } else {
      this.element.addClass('tb-element');
    }
    this.element.on('mouseenter', (_event) => {
      this.highlight();
    });
    this.element.on('mouseleave', (_event) => {
      this.unhighlight();
    });
    if (!this.invisible) {
      this.setupTooltips();
    }
    this.hideInvisible();
  }

  private setupTooltips() {
    if (this.hasTag()) {
      this.createTagTooltip();
    } else if (!this.readonly) {
      this.createAddTagTooltip();
    }
  }

  public showInvisible() {
    if (this.invisible) {
      this.element.show();
      if (!this.tooltip) {
        this.setupTooltips();
      }
    }
  }

  public hideInvisible() {
    if (this.invisible) {
      this.element.hide();
      if (this.tooltip) {
        this.tooltip.destroy();
        this.tooltip = null;
      }
    }
  }

  public restoreOrigVisibility() {
    if (this.origVisibility) {
      this.element.show();
    } else {
      this.element.hide();
    }
  }

  public overlappingCenters(otherElement: ScadaSymbolElement): boolean {
    if (this.isGroup() || otherElement.isGroup()) {
      return false;
    }
    return Math.abs(this.box.cx - otherElement.box.cx) * this.editObject.scale < elementTooltipMinWidth &&
      Math.abs(this.box.cy - otherElement.box.cy) * this.editObject.scale < elementTooltipMinHeight;
  }

  public highlight() {
    if (!this.highlighted) {
      this.highlighted = true;
      if (this.isGroup()) {
        this.highlightRectTimeline.finish();
        this.highlightRect
        .attr({
          rx: this.unscaled(6),
          'stroke-width': this.unscaled(groupRectStroke)
        });
        this.highlightRect.show();
        this.highlightRect.animate(300).attr({opacity: 1});
      } else {
        this.element.addClass('hovered');
      }
      if (this.hasTag()) {
        this.tooltip.reposition();
        $(this.tooltip.elementTooltip()).addClass('tb-active');
      }
    }
  }

  public unhighlight() {
    if (this.highlighted) {
      this.highlighted = false;
      if (this.isGroup()) {
        this.highlightRectTimeline.finish();
        this.highlightRect.animate(300).attr({opacity: 0}).after(() => {
          this.highlightRect.hide();
        });
      } else {
        this.element.removeClass('hovered');
      }
      if (this.hasTag() && !this.editing) {
        $(this.tooltip.elementTooltip()).removeClass('tb-active');
      }
    }
  }

  public clearTag() {
    this.tooltip.destroy();
    this.tag = null;
    this.element.attr('tb:tag', null);
    this.unhighlight();
    this.createAddTagTooltip();
    this.editObject.setDirty(true);
    this.editObject.updateTags();
  }

  public setTag(tag: string) {
    this.tooltip.destroy();
    this.tag = tag;
    this.element.attr('tb:tag', tag);
    this.createTagTooltip();
    this.editObject.setDirty(true);
    this.editObject.updateTags();
  }

  public hasStateRenderFunction(): boolean {
    if (this.hasTag()) {
      return this.editObject.tagHasStateRenderFunction(this.tag);
    } else {
      return false;
    }
  }

  public hasClickAction(): boolean {
    if (this.hasTag()) {
      return this.editObject.tagHasClickAction(this.tag);
    } else {
      return false;
    }
  }

  public editStateRenderFunction() {
    if (this.hasTag()) {
      this.editObject.editTagStateRenderFunction(this.tag);
    }
  }

  public editClickAction() {
    if (this.hasTag()) {
      this.editObject.editTagClickAction(this.tag);
    }
  }

  public startEdit(onCancelEdit: () => void) {
    if (!this.editing) {
      this.editObject.cancelEdit();
      this.editing = true;
      this.onCancelEdit = onCancelEdit;
    }
  }

  public stopEdit(cancel = false) {
    if (this.editing) {
      this.editing = false;
      if (cancel && this.onCancelEdit) {
        this.onCancelEdit();
      }
      this.onCancelEdit = null;
      if (this.hasTag() && !this.highlighted) {
        $(this.tooltip.elementTooltip()).removeClass('tb-active');
      }
    }
  }

  public isEditing() {
    return this.editing;
  }

  public updateTooltipPosition() {
    if (this.tooltip && !this.tooltip.status().destroyed) {
      this.tooltip.reposition();
      const tooltipElement = this.tooltip.elementTooltip();
      if (tooltipElement) {
        tooltipElement.style.visibility = null;
      }
    }
  }

  public hideTooltip() {
    if (this.tooltip && !this.tooltip.status().destroyed) {
      const tooltipElement = this.tooltip.elementTooltip();
      if (tooltipElement) {
        tooltipElement.style.visibility = 'hidden';
      }
    }
  }

  public restoreTooltip() {
    this.updateTooltipPosition();
  }

  public setInnerTooltipOffset(offset: number, center: number) {
    this.innerTooltipOffset = offset + (center - this.box.cy) * this.editObject.scale;
  }

  public destroy() {
    if (this.tooltip) {
      this.tooltip.destroy();
    }
  }

  public get tooltipContainer(): JQuery<HTMLElement> {
    return $(this.editObject.tooltipsContainer);
  }

  private unscaled(size: number): number {
    return size / (this.editObject.scale * this.editObject.svgShape.zoom());
  }

  private scaled(size: number): number {
    return size * (this.editObject.scale * this.editObject.svgShape.zoom());
  }

  private createTagTooltip() {
    const el = $(this.element.node);
    el.tooltipster(
      {
        parent: this.tooltipContainer,
        zIndex: 100,
        arrow: this.isGroup(),
        distance: this.isGroup() ? (this.scaled(groupRectPadding) + groupRectStroke) : 6,
        theme: ['scada-symbol'],
        delay: 0,
        animationDuration: 0,
        interactive: true,
        trigger: 'custom',
        side: 'top',
        trackOrigin: false,
        content: '',
        functionPosition: (instance, helper, position) =>
          this.innerTagTooltipPosition(instance, helper, position),
        functionReady: (_instance, helper) => {
          const tooltipEl = $(helper.tooltip);
          tooltipEl.on('mouseenter', () => {
            this.highlight();
          });
          tooltipEl.on('mouseleave', () => {
            this.unhighlight();
          });
        }
      }
    );
    this.tooltip = el.tooltipster('instance');
    this.setupTagPanel();
  }

  private setupTagPanel() {
    setupTagPanelTooltip(this, this.editObject.viewContainerRef);
  }

  private createAddTagTooltip() {
    const el = $(this.element.node);
    el.tooltipster(
      {
        parent: this.tooltipContainer,
        zIndex: 100,
        arrow: true,
        theme: ['scada-symbol', 'tb-active'],
        delay: [0, 300],
        interactive: true,
        trigger: 'hover',
        side: ['top', 'left', 'bottom', 'right'],
        trackOrigin: false,
        content: '',
        functionBefore: (instance, helper) => {
          const mouseEvent = (helper.event as MouseEvent);
          this.tooltipMouseX = mouseEvent.clientX;
          this.tooltipMouseY = mouseEvent.clientY;
          let side: TooltipPositioningSide;
          if (this.isGroup()) {
            side = 'top';
          } else {
            side = this.calculateTooltipSide(helper.origin.getBoundingClientRect(),
              mouseEvent.clientX, mouseEvent.clientY);
          }
          instance.option('side', side);
        },
        functionPosition: (instance, helper, position) =>
          this.innerAddTagTooltipPosition(instance, helper, position),
        functionReady: (_instance, helper) => {
          const tooltipEl = $(helper.tooltip);
          tooltipEl.on('mouseenter', () => {
            this.highlight();
          });
          tooltipEl.on('mouseleave', () => {
            this.unhighlight();
          });
        }
      }
    );
    this.tooltip = el.tooltipster('instance');
    this.setupAddTagPanel();
  }

  private setupAddTagPanel() {
    setupAddTagPanelTooltip(this, this.editObject.viewContainerRef);
  }

  private innerTagTooltipPosition(_instance: ITooltipsterInstance, helper: ITooltipsterHelper,
                                  position: ITooltipPosition): ITooltipPosition {
    const clientRect = helper.origin.getBoundingClientRect();
    if (!this.isGroup()) {
      position.coord.top = clientRect.top + (clientRect.height - position.size.height) / 2
        + this.innerTooltipOffset * this.editObject.svgShape.zoom();
      position.coord.left = clientRect.left + (clientRect.width - position.size.width) / 2;
    } else {
      position.distance = this.scaled(groupRectPadding) + groupRectStroke;
      position.coord.top = clientRect.top - position.size.height - (this.scaled(groupRectPadding) + groupRectStroke);
    }
    return position;
  }

  private innerAddTagTooltipPosition(_instance: ITooltipsterInstance,
                                     _helper: ITooltipsterHelper, position: ITooltipPosition): ITooltipPosition {
    const distance = 10;
    switch (position.side) {
      case 'right':
        position.coord.top = this.tooltipMouseY - position.size.height / 2;
        position.coord.left = this.tooltipMouseX + distance;
        position.target = this.tooltipMouseY;
        break;
      case 'top':
        position.coord.top = this.tooltipMouseY - position.size.height - distance;
        position.coord.left = this.tooltipMouseX - position.size.width / 2;
        position.target = this.tooltipMouseX;
        if (this.isGroup()) {
          position.coord.top -= elementTooltipMinHeight;
        }
        break;
      case 'left':
        position.coord.top = this.tooltipMouseY - position.size.height / 2;
        position.coord.left = this.tooltipMouseX - position.size.width - distance;
        position.target = this.tooltipMouseY;
        break;
      case 'bottom':
        position.coord.top = this.tooltipMouseY + distance;
        position.coord.left = this.tooltipMouseX - position.size.width / 2;
        position.target = this.tooltipMouseX;
        break;
    }
    return position;
  }

  private calculateTooltipSide(clientRect: DOMRect, mouseX: number, mouseY: number): TooltipPositioningSide {
    let side: TooltipPositioningSide;
    const cx = clientRect.left + clientRect.width / 2;
    const cy = clientRect.top + clientRect.height / 2;
    if (clientRect.width > clientRect.height) {
      if (Math.abs(cx - mouseX) > clientRect.width / 4) {
        if (mouseX < cx) {
          side = 'left';
        } else {
          side = 'right';
        }
      } else {
        if (mouseY < cy) {
          side = 'top';
        } else {
          side = 'bottom';
        }
      }
    } else {
      if (Math.abs(cy - mouseY) > clientRect.height / 4) {
        if (mouseY < cy) {
          side = 'top';
        } else {
          side = 'bottom';
        }
      } else {
        if (mouseX < cx) {
          side = 'left';
        } else {
          side = 'right';
        }
      }
    }
    return side;
  }

  public hasTag() {
    return !!this.tag;
  }

  public isGroup() {
    return this.element.type === 'g';
  }

  public isText() {
    return this.element.type === 'text';
  }

}

const scadaSymbolCtxObjectHighlightRules: TbHighlightRule[] = [
  {
    class: 'scada-symbol-ctx',
    regex: /(?<=\W|^)(ctx)(?=\W|$)\b/
  }
];

export const scadaSymbolGeneralStateRenderHighlightRules: TbHighlightRule[] =
  scadaSymbolCtxObjectHighlightRules.concat({
    class: 'scada-symbol-svg',
    regex: /(?<=\W|^)(svg)(?=\W|$)\b/
  });

export const scadaSymbolElementStateRenderHighlightRules: TbHighlightRule[] =
  scadaSymbolCtxObjectHighlightRules.concat({
    class: 'scada-symbol-element',
    regex: /(?<=\W|^)(element)(?=\W|$)\b/
  });

export const scadaSymbolClickActionHighlightRules: TbHighlightRule[] =
  scadaSymbolElementStateRenderHighlightRules.concat({
    class: 'scada-symbol-event',
    regex: /(?<=\W|^)(event)(?=\W|$)\b/
  });

const scadaSymbolCtxPropertyHighlightRules: TbHighlightRule[] = [
  {
    class: 'scada-symbol-ctx-properties',
    regex: /(?<=ctx\.)(properties)\b/
  },
  {
    class: 'scada-symbol-ctx-tags',
    regex: /(?<=ctx\.)(tags)\b/
  },
  {
    class: 'scada-symbol-ctx-values',
    regex: /(?<=ctx\.)(values)\b/
  },
  {
    class: 'scada-symbol-ctx-api',
    regex: /(?<=ctx\.)(api)\b/
  },
  {
    class: 'scada-symbol-ctx-svg',
    regex: /(?<=ctx\.)(svg)\b/
  },
  {
    class: 'scada-symbol-ctx-property',
    regex: /(?<=ctx\.properties\.)([a-zA-Z$_\u00a1-\uffff][a-zA-Z\d$_\u00a1-\uffff]*)\b/
  },
  {
    class: 'scada-symbol-ctx-tag',
    regex: /(?<=ctx\.tags\.)([a-zA-Z$_\u00a1-\uffff][a-zA-Z\d$_\u00a1-\uffff]*)\b/
  },
  {
    class: 'scada-symbol-ctx-value',
    regex: /(?<=ctx\.values\.)([a-zA-Z$_\u00a1-\uffff][a-zA-Z\d$_\u00a1-\uffff]*)\b/
  },
  {
    class: 'scada-symbol-ctx-api-method',
    regex: /(?<=ctx\.api\.)([a-zA-Z$_\u00a1-\uffff][a-zA-Z\d$_\u00a1-\uffff]*)\b/
  },
  {
    class: 'scada-symbol-ctx-svg-method',
    regex: /(?<=ctx\.svg\.)([a-zA-Z$_\u00a1-\uffff][a-zA-Z\d$_\u00a1-\uffff]*)\b/
  }
];

export const scadaSymbolGeneralStateRenderPropertiesHighlightRules: TbHighlightRule[] =
  scadaSymbolCtxPropertyHighlightRules.concat({
    class: 'scada-symbol-svg-properties',
    regex: /(?<=svg\.)([a-zA-Z$_\u00a1-\uffff][a-zA-Z\d$_\u00a1-\uffff]*)\b/
  });

export const scadaSymbolElementStateRenderPropertiesHighlightRules: TbHighlightRule[] =
  scadaSymbolCtxPropertyHighlightRules.concat({
    class: 'scada-symbol-element-properties',
    regex: /(?<=element\.)([a-zA-Z$_\u00a1-\uffff][a-zA-Z\d$_\u00a1-\uffff]*)\b/
  });

export const scadaSymbolClickActionPropertiesHighlightRules: TbHighlightRule[] =
  scadaSymbolElementStateRenderPropertiesHighlightRules.concat({
    class: 'scada-symbol-event-properties',
    regex: /(?<=event\.)([a-zA-Z$_\u00a1-\uffff][a-zA-Z\d$_\u00a1-\uffff]*)\b/
  });

export const generalStateRenderFunctionCompletions = (ctxCompletion: TbEditorCompletion): TbEditorCompletions => ({
    ctx: ctxCompletion,
    svg: {
      meta: 'argument',
      type: '<a href="https://svgjs.dev/docs/3.2/container-elements/#svg-svg">SVG.Svg</a>',
      description: 'A root svg node. Instance of <a href="https://svgjs.dev/docs/3.2/container-elements/#svg-svg">SVG.Svg</a>.'
    }
  });

export const elementStateRenderFunctionCompletions = (ctxCompletion: TbEditorCompletion): TbEditorCompletions => ({
    ctx: ctxCompletion,
    element: {
      meta: 'argument',
      type: 'Element',
      description: 'SVG element.<br>' +
        'See <a href="https://svgjs.dev/docs/3.2/manipulating/">Manipulating</a> section to manipulate the element.<br>' +
        'See <a href="https://svgjs.dev/docs/3.2/animating/">Animating</a> section to animate the element.'
    }
  });

export const clickActionFunctionCompletions = (ctxCompletion: TbEditorCompletion): TbEditorCompletions => {
  const completions = elementStateRenderFunctionCompletions(ctxCompletion);
  completions.event = {
    meta: 'argument',
    type: 'Event',
    description: 'DOM event.'
  };
  return completions;
};

export const scadaSymbolContextCompletion = (metadata: ScadaSymbolMetadata, tags: string[],
                                             customTranslate: CustomTranslatePipe): TbEditorCompletion => {
  const properties: TbEditorCompletion = {
    meta: 'object',
    type: 'object',
    description: 'An object holding all defined SCADA symbol properties.',
    children: {}
  };
  for (const property of metadata.properties) {
    properties.children[property.id] = scadaSymbolPropertyCompletion(property, customTranslate);
  }
  const values: TbEditorCompletion = {
    meta: 'object',
    type: 'object',
    description: 'An object holding all values obtained using behaviors of type <b>"Value"</b>',
    children: {}
  };
  const getValues = metadata.behavior.filter(b => b.type === ScadaSymbolBehaviorType.value);
  for (const value of getValues) {
    values.children[value.id] = scadaSymbolValueCompletion(value, customTranslate);
  }
  const tagsCompletions: TbEditorCompletion = {
    meta: 'object',
    type: 'object',
    description: 'An object holding all tagged SVG elements grouped by tags (object keys).',
    children: {}
  };
  if (tags?.length) {
    for (const tag of tags) {
      tagsCompletions.children[tag] = {
        meta: 'property',
        description: 'An array of SVG elements.',
        type: 'Array<Element>'
      };
    }
  }
  return {
    meta: 'argument',
    type: 'ScadaSymbolContext',
    description: 'Context of the SCADA symbol.',
    children: {
      api: {
        meta: 'object',
        type: 'ScadaSymbolApi',
        description: 'SCADA symbol API',
        children: {
          animate: {
            meta: 'function',
            description: 'Finishes any previous animation and starts new animation for SVG element.',
            args: [
              {
                name: 'element',
                description: 'SVG element',
                type: 'Element'
              },
              {
                name: 'duration',
                description: 'Animation duration in milliseconds',
                type: 'number'
              }
            ],
            return: {
              description: 'Instance of SVG.Runner which has the same methods as any element and additional methods to control the runner.',
              type: '<a href="https://svgjs.dev/docs/3.2/animating/#svg-runner">SVG.Runner</a>'
            }
          },
          resetAnimation: {
            meta: 'function',
            description: 'Stops animation if any and restore SVG element initial state, resets animation timeline.',
            args: [
              {
                name: 'element',
                description: 'SVG element',
                type: 'Element'
              },
            ]
          },
          finishAnimation: {
            meta: 'function',
            description: 'Finishes animation if any, SVG element state updated according to the end animation values, ' +
              'resets animation timeline.',
            args: [
              {
                name: 'element',
                description: 'SVG element',
                type: 'Element'
              },
            ]
          },
          generateElementId: {
            meta: 'function',
            description: 'Generates new unique element id.',
            args: [],
            return: {
              type: 'string',
              description: 'Newly generated element id.'
            }
          },
          formatValue: {
            meta: 'function',
            description: 'Formats numeric value according to specified decimals and units',
            args: [
              {
                name: 'value',
                description: 'Numeric value to be formatted',
                type: 'any'
              },
              {
                name: 'dec',
                description: 'Number of decimal digits',
                type: 'number',
                optional: true
              },
              {
                name: 'units',
                description: 'Units to append to the formatted value',
                type: 'string',
                optional: true
              },
              {
                name: 'showZeroDecimals',
                description: 'Whether to keep zero decimal digits',
                type: 'boolean',
                optional: true
              }
            ],
            return: {
              type: 'string',
              description: 'Formatted value'
            }
          },
          text: {
            meta: 'function',
            description: 'Set text to element(s). Only applicable for elements of type ' +
              '<a href="https://svgjs.dev/docs/3.2/shape-elements/#svg-text">SVG.Text</a> or ' +
              '<a href="https://svgjs.dev/docs/3.2/shape-elements/#svg-tspan">SVG.Tspan</a>.',
            args: []
          },
          font: {
            meta: 'function',
            description: 'Set element(s) text font and color. Only applicable for elements of type ' +
              '<a href="https://svgjs.dev/docs/3.2/shape-elements/#svg-text">SVG.Text</a> or ' +
              '<a href="https://svgjs.dev/docs/3.2/shape-elements/#svg-tspan">SVG.Tspan</a>.',
            args: []
          },
          disable: {
            meta: 'function',
            description: 'Disables element(s). Disabled element doesn\'t accept any user interaction. ' +
              'For ex. if disabled element has click action, no click action will be performed on user click.',
            args: []
          },
          enable: {
            meta: 'function',
            description: 'Enables disabled element(s). Enabled element accepts user interaction. ' +
              'For ex. if element has click action, click action will be performed on user click.',
            args: []
          },
          callAction: {
            meta: 'function',
            description: 'Invokes action specified by behavior of type <b>"Action"</b> found by <b>behaviorId</b>.',
            args: []
          },
          setValue: {
            meta: 'function',
            description: 'Updates value by <b>valueId</b>. See <code>ctx.values</code> for reference. ' +
              'Value update triggers all render functions.',
            args: []
          }
        }
      },
      properties,
      values,
      tags: tagsCompletions,
      svg: {
        meta: 'argument',
        type: '<a href="https://svgjs.dev/docs/3.2/container-elements/#svg-svg">SVG.Svg</a>',
        description: 'A root svg node. Instance of <a href="https://svgjs.dev/docs/3.2/container-elements/#svg-svg">SVG.Svg</a>.'
      }
    }
  };
};

const scadaSymbolPropertyCompletion = (property: ScadaSymbolProperty, customTranslate: CustomTranslatePipe): TbEditorCompletion => {
  let description = customTranslate.transform(property.name, property.name);
  if (property.subLabel) {
    description += ` <small>${customTranslate.transform(property.subLabel, property.subLabel)}</small>`;
  }
  return {
    meta: 'property',
    description,
    type: scadaSymbolPropertyCompletionType(property.type)
  };
};

const scadaSymbolValueCompletion = (value: ScadaSymbolBehavior, customTranslate: CustomTranslatePipe): TbEditorCompletion => {
  const description = customTranslate.transform(value.name, value.name);
  return {
    meta: 'property',
    description,
    type: scadaSymbolValueCompletionType(value.valueType)
  };
};

const scadaSymbolPropertyCompletionType = (type: ScadaSymbolPropertyType): string => {
  switch (type) {
    case ScadaSymbolPropertyType.text:
      return 'string';
    case ScadaSymbolPropertyType.number:
      return 'number';
    case ScadaSymbolPropertyType.switch:
      return 'boolean';
    case ScadaSymbolPropertyType.color:
      return 'color string';
    case ScadaSymbolPropertyType.color_settings:
      return 'ColorProcessor';
    case ScadaSymbolPropertyType.font:
      return 'Font';
    case ScadaSymbolPropertyType.units:
      return 'units string';
  }
};

const scadaSymbolValueCompletionType = (type: ValueType): string => {
  switch (type) {
    case ValueType.STRING:
      return 'string';
    case ValueType.INTEGER:
    case ValueType.DOUBLE:
      return 'number';
    case ValueType.BOOLEAN:
      return 'boolean';
    case ValueType.JSON:
      return 'object';
  }
};