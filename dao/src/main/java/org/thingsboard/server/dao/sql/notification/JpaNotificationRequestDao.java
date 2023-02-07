/**
 * Copyright © 2016-2022 The Thingsboard Authors
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
package org.thingsboard.server.dao.sql.notification;

import com.google.common.base.Strings;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;
import org.thingsboard.common.util.JacksonUtil;
import org.thingsboard.server.common.data.EntityType;
import org.thingsboard.server.common.data.id.EntityId;
import org.thingsboard.server.common.data.id.NotificationRequestId;
import org.thingsboard.server.common.data.id.NotificationRuleId;
import org.thingsboard.server.common.data.id.NotificationTargetId;
import org.thingsboard.server.common.data.id.NotificationTemplateId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.notification.NotificationRequest;
import org.thingsboard.server.common.data.notification.NotificationRequestInfo;
import org.thingsboard.server.common.data.notification.NotificationRequestStats;
import org.thingsboard.server.common.data.notification.NotificationRequestStatus;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.DaoUtil;
import org.thingsboard.server.dao.model.sql.NotificationRequestEntity;
import org.thingsboard.server.dao.model.sql.NotificationRequestInfoEntity;
import org.thingsboard.server.dao.notification.NotificationRequestDao;
import org.thingsboard.server.dao.sql.JpaAbstractDao;
import org.thingsboard.server.dao.util.SqlDao;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.thingsboard.server.dao.DaoUtil.getId;

@Component
@SqlDao
@RequiredArgsConstructor
public class JpaNotificationRequestDao extends JpaAbstractDao<NotificationRequestEntity, NotificationRequest> implements NotificationRequestDao {

    private final NotificationRequestRepository notificationRequestRepository;

    @Override
    public PageData<NotificationRequest> findByTenantIdAndOriginatorTypeAndPageLink(TenantId tenantId, EntityType originatorType, PageLink pageLink) {
        return DaoUtil.toPageData(notificationRequestRepository.findByTenantIdAndOriginatorEntityType(getId(tenantId, true),
                originatorType, DaoUtil.toPageable(pageLink)));
    }

    @Override
    public PageData<NotificationRequestInfo> findInfosByTenantIdAndOriginatorTypeAndPageLink(TenantId tenantId, EntityType originatorType, PageLink pageLink) {
        return DaoUtil.pageToPageData(notificationRequestRepository.findInfosByTenantIdAndOriginatorEntityTypeAndSearchText(getId(tenantId, true),
                originatorType, Strings.nullToEmpty(pageLink.getTextSearch()), DaoUtil.toPageable(pageLink))).mapData(NotificationRequestInfoEntity::toData);
    }

    @Override
    public List<NotificationRequestId> findIdsByRuleId(TenantId tenantId, NotificationRequestStatus requestStatus, NotificationRuleId ruleId) {
        return notificationRequestRepository.findAllIdsByStatusAndRuleId(requestStatus, ruleId.getId()).stream()
                .map(NotificationRequestId::new).collect(Collectors.toList());
    }

    @Override
    public List<NotificationRequest> findByRuleIdAndOriginatorEntityId(TenantId tenantId, NotificationRuleId ruleId, EntityId originatorEntityId) {
        return DaoUtil.convertDataList(notificationRequestRepository.findAllByRuleIdAndOriginatorEntityTypeAndOriginatorEntityId(ruleId.getId(), originatorEntityId.getEntityType(), originatorEntityId.getId()));
    }

    @Override
    public PageData<NotificationRequest> findAllByStatus(NotificationRequestStatus status, PageLink pageLink) {
        return DaoUtil.toPageData(notificationRequestRepository.findAllByStatus(status, DaoUtil.toPageable(pageLink)));
    }

    @Override
    public void updateById(TenantId tenantId, NotificationRequestId requestId, NotificationRequestStatus requestStatus, NotificationRequestStats stats) {
        notificationRequestRepository.updateStatusAndStatsById(requestId.getId(), requestStatus, JacksonUtil.valueToTree(stats));
    }

    @Override
    public boolean existsByStatusAndTargetId(TenantId tenantId, NotificationRequestStatus status, NotificationTargetId targetId) {
        return notificationRequestRepository.existsByStatusAndTargetsContaining(status, targetId.getId().toString());
    }

    @Override
    public boolean existsByStatusAndTemplateId(TenantId tenantId, NotificationRequestStatus status, NotificationTemplateId templateId) {
        return notificationRequestRepository.existsByStatusAndTemplateId(status, templateId.getId());
    }

    @Override
    public int removeAllByCreatedTimeBefore(long ts) {
        return notificationRequestRepository.deleteAllByCreatedTimeBefore(ts);
    }

    @Override
    public NotificationRequestInfo findInfoById(TenantId tenantId, NotificationRequestId id) {
        NotificationRequestInfoEntity info = notificationRequestRepository.findInfoById(id.getId());
        return info != null ? info.toData() : null;
    }

    @Override
    protected Class<NotificationRequestEntity> getEntityClass() {
        return NotificationRequestEntity.class;
    }

    @Override
    protected JpaRepository<NotificationRequestEntity, UUID> getRepository() {
        return notificationRequestRepository;
    }

    @Override
    public EntityType getEntityType() {
        return EntityType.NOTIFICATION_REQUEST;
    }

}