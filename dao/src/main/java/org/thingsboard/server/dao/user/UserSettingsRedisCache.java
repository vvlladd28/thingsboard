/**
 * Copyright © 2016-2025 The Thingsboard Authors
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
package org.thingsboard.server.dao.user;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Service;
import org.thingsboard.server.cache.CacheSpecsMap;
import org.thingsboard.server.cache.RedisTbTransactionalCache;
import org.thingsboard.server.cache.TBRedisCacheConfiguration;
import org.thingsboard.server.cache.TbJsonRedisSerializer;
import org.thingsboard.server.common.data.CacheConstants;
import org.thingsboard.server.common.data.settings.UserSettings;
import org.thingsboard.server.common.data.settings.UserSettingsCompositeKey;

@ConditionalOnProperty(prefix = "cache", value = "type", havingValue = "redis")
@Service("UserSettingsCache")
public class UserSettingsRedisCache extends RedisTbTransactionalCache<UserSettingsCompositeKey, UserSettings> {

    public UserSettingsRedisCache(TBRedisCacheConfiguration configuration, CacheSpecsMap cacheSpecsMap, RedisConnectionFactory connectionFactory) {
        super(CacheConstants.USER_SETTINGS_CACHE, cacheSpecsMap, connectionFactory, configuration, new TbJsonRedisSerializer<>(UserSettings.class));
    }
}
