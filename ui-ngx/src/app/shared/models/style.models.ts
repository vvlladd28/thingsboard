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

interface CornerRadius {
  x: string;
  y: string;
}

interface BorderRadius {
  topLeft: CornerRadius;
  topRight: CornerRadius;
  bottomRight: CornerRadius;
  bottomLeft: CornerRadius;
}

interface PaddingUnit {
  value: number;
  unit: string;
}

interface Padding {
  top: PaddingUnit;
  right: PaddingUnit;
  bottom: PaddingUnit;
  left: PaddingUnit;
}

const validUnits = ['px', 'rem', 'em', '%', 'vw', 'vh', 'vmin', 'vmax'];

function strignifyCssProperty(arr: string[]): string {
  if (arr[0] === arr[1] && arr[0] === arr[2] && arr[0] === arr[3]) {
    return arr[0];
  }
  if (arr[0] === arr[2] && arr[1] === arr[3]) {
    return `${arr[0]} ${arr[1]}`;
  }
  if (arr[1] === arr[3]) {
    return `${arr[0]} ${arr[1]} ${arr[2]}`;
  }
  return arr.join(' ');
}

function parseBorderRadius(value: string): BorderRadius {
  const parts = value.trim().split("/").map(part => part.trim());

  const validateValue = (val: string): string => {
    const m = val.match(/^(\d*\.?\d+)([a-z%]+)$/i) as [string, string, string] | null;
    if (!m || !validUnits.includes(m[2].toLowerCase())) {
      return '0px';
    }
    return val;
  };

  const expand = (arr: string[]): string[] => {
    const validated = arr.map(validateValue).filter(v => v !== '');
    switch (validated.length) {
      case 1:
        return [validated[0], validated[0], validated[0], validated[0]];
      case 2:
        return [validated[0], validated[1], validated[0], validated[1]];
      case 3:
        return [validated[0], validated[1], validated[2], validated[1]];
      case 4:
        return [validated[0], validated[1], validated[2], validated[3]];
      default:
        return ['0px', '0px', '0px', '0px'];
    }
  };

  const h = parts[0].split(/\s+/);
  const v = parts[1] ? parts[1].split(/\s+/) : [];
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

  const hStr = strignifyCssProperty(h);
  const vStr = strignifyCssProperty(v);

  return hStr === vStr ? hStr : `${hStr} / ${vStr}`;
}

export const extractBorderRadiusStyle = (styles: Record<string, string>): string => {
  const shorthand = styles.borderRadius || '0px';
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
      const validated = value.match(/^(\d*\.?\d+)([a-z%]+)$/i) && validUnits.includes(value.match(/([a-z%]+)$/i)?.[1].toLowerCase() || '') ? value : '0px';
      br[corner] = { x: validated, y: validated };
    }
  }

  return stringifyBorderRadius(br);
}

function parsePadding(shorthand: string): Padding {
  const parts = shorthand.trim().split(/\s+/).filter(part => part !== '');
  if (parts.length < 1 || parts.length > 4) {
    return {
      top: {value: 0, unit: 'px'},
      right: {value: 0, unit: 'px'},
      bottom: {value: 0, unit: 'px'},
      left: {value: 0, unit: 'px'},
    };
  }

  const parseToken = (token: string): PaddingUnit => {
    const m = token.match(/^(-?\d*\.?\d+)([a-z%]+)$/i) as [string, string, string] | null;
    if (!m || !validUnits.includes(m[2].toLowerCase())) {
      return { value: 0, unit: 'px' };
    }
    return { value: parseFloat(m[1]), unit: m[2] };
  };

  const paddings = parts.map(parseToken);
  switch (paddings.length) {
    case 1:
      return {top: paddings[0], right: paddings[0], bottom: paddings[0], left: paddings[0]};
    case 2:
      return {top: paddings[0], right: paddings[1], bottom: paddings[0], left: paddings[1]};
    case 3:
      return {top: paddings[0], right: paddings[1], bottom: paddings[3], left: paddings[1]};
    default:
      return {top: paddings[0], right: paddings[1], bottom: paddings[3], left: paddings[4]};
  }
}

function mergePaddingSide(a: PaddingUnit, b: PaddingUnit): string {
  if (a.unit === b.unit) {
    const sum = a.value + b.value;
    return `${sum}${a.unit}`;
  } else {
    return `calc(${a.value}${a.unit} + ${b.value}${b.unit})`;
  }
}

export function mergePadding(a: string, b: string): string {
  if (typeof a !== 'string' || typeof b !== 'string') {
    throw new Error('Inputs must be strings');
  }
  const p1 = parsePadding(a);
  const p2 = parsePadding(b);

  const mergedSides: [string, string, string, string] = [
    mergePaddingSide(p1.top, p2.top),
    mergePaddingSide(p1.right, p2.right),
    mergePaddingSide(p1.bottom, p2.bottom),
    mergePaddingSide(p1.left, p2.left),
  ];

  return strignifyCssProperty(mergedSides);
}
