/**
 * Copyright © 2016-2024 The Thingsboard Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.thingsboard.server.cache.edge;

import lombok.Data;
import org.thingsboard.server.common.data.id.EdgeId;
import org.thingsboard.server.common.data.page.PageData;

import java.io.Serial;
import java.io.Serializable;

@Data
public class RelatedEdgesCacheValue implements Serializable {

    @Serial
    private static final long serialVersionUID = -2765080094748518572L;

    private final PageData<EdgeId> pageData;

    public RelatedEdgesCacheValue(PageData<EdgeId> pageData) {
        this.pageData = pageData;
    }

}