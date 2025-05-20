///
/// Copyright © 2016-2025 The Thingsboard Authors
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

export interface CornerRadius {
  x: string;
  y: string;
}

export interface BorderRadius {
  topLeft: CornerRadius;
  topRight: CornerRadius;
  bottomRight: CornerRadius;
  bottomLeft: CornerRadius;
}

export interface Padding {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

function parseBorderRadius(value: string): BorderRadius {
  const parts = value.trim().split("/").map(part => part.trim());
  const h = parts[0].split(/\s+/);
  const v = parts[1] ? parts[1].split(/\s+/) : [];

  const expand = (arr: string[]): string[] => {
    switch (arr.length) {
      case 1:
        return [arr[0], arr[0], arr[0], arr[0]];
      case 2:
        return [arr[0], arr[1], arr[0], arr[1]];
      case 3:
        return [arr[0], arr[1], arr[2], arr[1]];
      case 4:
        return [arr[0], arr[1], arr[2], arr[3]];
      default:
        return [];
    }
  };

  const hVals = expand(h);
  const vVals = v.length ? expand(v) : hVals;

  return {
    topLeft: { x: hVals[0], y: vVals[0] },
    topRight: { x: hVals[1], y: vVals[1] },
    bottomRight: { x: hVals[2], y: vVals[2] },
    bottomLeft: { x: hVals[3], y: vVals[3] },
  };
}

function stringifyBorderRadius(br: BorderRadius): string {
  const h = [br.topLeft.x, br.topRight.x, br.bottomRight.x, br.bottomLeft.x];
  const v = [br.topLeft.y, br.topRight.y, br.bottomRight.y, br.bottomLeft.y];

  const allSame = (arr: string[]) => arr.every(val => val === arr[0]);

  const toShorthand = (arr: string[]): string => {
    // 1-4 values shorthand compression
    if (allSame(arr)) return arr[0];
    if (arr[0] === arr[2] && arr[1] === arr[3]) return `${arr[0]} ${arr[1]}`;
    if (arr[1] === arr[3]) return `${arr[0]} ${arr[1]} ${arr[2]}`;
    return arr.join(' ');
  };

  const hStr = toShorthand(h);
  const vStr = toShorthand(v);

  if (hStr === vStr) {
    return hStr;
  }
  return `${hStr} / ${vStr}`;
}

export const extractBorderRadiusStyle = (styles: Record<string, string>): string => {
  const shorthand = styles.borderRadius || '0';
  const br = parseBorderRadius(shorthand);

  const cornerMap: Record<string, keyof BorderRadius> = {
    borderTopLeftRadius: 'topLeft',
    borderTopRightRadius: 'topRight',
    borderBottomRightRadius: 'bottomRight',
    borderBottomLeftRadius: 'bottomLeft',
  };

  for (const [key, corner] of Object.entries(cornerMap)) {
    const value = styles[key];
    if (value != null) {
      br[corner] = { x: value, y: value };
    }
  }

  return stringifyBorderRadius(br);
}

export function parsePadding(value: string): Padding {
  const arr = value.trim().split(/\s+/);
  const expand = (a: string[]): string[] => {
    switch (a.length) {
      case 1: return [a[0], a[0], a[0], a[0]];
      case 2: return [a[0], a[1], a[0], a[1]];
      case 3: return [a[0], a[1], a[2], a[1]];
      case 4: return [a[0], a[1], a[2], a[3]];
      default: return [];
    }
  };
  const [t, r, b, l] = expand(arr);
  return { top: t, right: r, bottom: b, left: l };
}

export function stringifyPadding(p: Padding): string {
  const vals = [p.top, p.right, p.bottom, p.left];
  const allSame = vals.every(v => v === vals[0]);
  if (allSame) return vals[0];
  if (vals[0] === vals[2] && vals[1] === vals[3]) return `${vals[0]} ${vals[1]}`;
  if (vals[1] === vals[3]) return `${vals[0]} ${vals[1]} ${vals[2]}`;
  return vals.join(' ');
}

export const extractPaddingStyle = (styles: Record<string, string>): string => {
  const shorthand = styles.padding || '0';
  const pd = parsePadding(shorthand);
  const map: Record<string, keyof Padding> = {
    paddingTop: 'top',
    paddingRight: 'right',
    paddingBottom: 'bottom',
    paddingLeft: 'left',
  };
  for (const key in map) {
    if (styles[key]) {
      pd[map[key]] = styles[key];
    }
  }
  return stringifyPadding(pd);
}

