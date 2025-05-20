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

import tinycolor from 'tinycolor2';

export interface TbColor {
  light: string;
  dark: string;
}

export interface TbColorScheme {
  [key: string]: TbColor;
}

export const getBlendedColor = (background: string, foreground: string): string => {
  if (tinycolor(foreground).getAlpha() !== 1) {
    const bg = tinycolor(background).toRgb();
    const fg = tinycolor(foreground).toRgb();
    const a = (fg.a + bg.a * (1 - fg.a));
    const r = Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a);
    const g = Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a);
    const b = Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a);
    return tinycolor({r, g, b, a}).toString();
  }
  return foreground;
}
