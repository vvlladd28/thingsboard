/**
 * Copyright © 2016-2026 The Thingsboard Authors
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
package org.thingsboard.server.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.thingsboard.common.util.JacksonUtil;
import org.thingsboard.script.api.tbel.TbelCfArg;
import org.thingsboard.script.api.tbel.TbelCfCtx;
import org.thingsboard.script.api.tbel.TbelCfSingleValueArg;
import org.thingsboard.script.api.tbel.TbelInvokeService;
import org.thingsboard.server.common.data.EntityType;
import org.thingsboard.server.common.data.EventInfo;
import org.thingsboard.server.common.data.cf.AlarmRuleDefinition;
import org.thingsboard.server.common.data.cf.AlarmRuleDefinitionInfo;
import org.thingsboard.server.common.data.cf.CalculatedField;
import org.thingsboard.server.common.data.cf.CalculatedFieldFilter;
import org.thingsboard.server.common.data.cf.CalculatedFieldInfo;
import org.thingsboard.server.common.data.cf.CalculatedFieldType;
import org.thingsboard.server.common.data.event.EventType;
import org.thingsboard.server.common.data.exception.ThingsboardException;
import org.thingsboard.server.common.data.id.CalculatedFieldId;
import org.thingsboard.server.common.data.id.EntityId;
import org.thingsboard.server.common.data.id.EntityIdFactory;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.config.annotations.ApiOperation;
import org.thingsboard.server.dao.event.EventService;
import org.thingsboard.server.queue.util.TbCoreComponent;
import org.thingsboard.server.service.cf.ctx.state.CalculatedFieldTbelScriptEngine;
import org.thingsboard.server.service.entitiy.cf.TbCalculatedFieldService;
import org.thingsboard.server.service.security.model.SecurityUser;
import org.thingsboard.server.service.security.permission.Operation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static org.thingsboard.server.controller.CalculatedFieldController.TIMEOUT;
import static org.thingsboard.server.controller.ControllerConstants.CF_TEXT_SEARCH_DESCRIPTION;
import static org.thingsboard.server.controller.ControllerConstants.ENTITY_ID_PARAM_DESCRIPTION;
import static org.thingsboard.server.controller.ControllerConstants.ENTITY_TYPE_PARAM_DESCRIPTION;
import static org.thingsboard.server.controller.ControllerConstants.MARKDOWN_CODE_BLOCK_END;
import static org.thingsboard.server.controller.ControllerConstants.MARKDOWN_CODE_BLOCK_START;
import static org.thingsboard.server.controller.ControllerConstants.PAGE_NUMBER_DESCRIPTION;
import static org.thingsboard.server.controller.ControllerConstants.PAGE_SIZE_DESCRIPTION;
import static org.thingsboard.server.controller.ControllerConstants.SORT_ORDER_DESCRIPTION;
import static org.thingsboard.server.controller.ControllerConstants.SORT_PROPERTY_DESCRIPTION;
import static org.thingsboard.server.controller.ControllerConstants.TENANT_AUTHORITY_PARAGRAPH;
import static org.thingsboard.server.controller.ControllerConstants.UUID_WIKI_LINK;

@RestController
@TbCoreComponent
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class AlarmRuleController extends BaseController {

    private final TbCalculatedFieldService tbCalculatedFieldService;
    private final CalculatedFieldController calculatedFieldController;
    private final EventService eventService;
    private final TbelInvokeService tbelInvokeService;

    public static final String ALARM_RULE_ID = "alarmRuleId";

    private static final String TEST_SCRIPT_EXPRESSION =
            "Execute the alarm rule TBEL condition expression and return the result. " +
            "Alarm rule expressions must return a boolean value. The format of request: \n\n"
            + MARKDOWN_CODE_BLOCK_START
            + "{\n" +
            "  \"expression\": \"return temperature > 50;\",\n" +
            "  \"arguments\": {\n" +
            "    \"temperature\": { \"type\": \"SINGLE_VALUE\", \"ts\": 1739776478057, \"value\": 55 }\n" +
            "  }\n" +
            "}"
            + MARKDOWN_CODE_BLOCK_END
            + "\n\n Expected result JSON contains \"output\" and \"error\".";

    @ApiOperation(value = "Create Or Update Alarm Rule (saveAlarmRule)",
            notes = "Creates or Updates the Alarm Rule. When creating alarm rule, platform generates Alarm Rule Id as " + UUID_WIKI_LINK +
                    "The newly created Alarm Rule Id will be present in the response. " +
                    "Specify existing Alarm Rule Id to update the alarm rule. " +
                    "Referencing non-existing Alarm Rule Id will cause 'Not Found' error. " +
                    "Remove 'id', 'tenantId' from the request body example (below) to create new Alarm Rule entity. "
                    + TENANT_AUTHORITY_PARAGRAPH)
    @PreAuthorize("hasAuthority('TENANT_ADMIN')")
    @PostMapping("/alarm/rule")
    public AlarmRuleDefinition saveAlarmRule(@io.swagger.v3.oas.annotations.parameters.RequestBody(description = "A JSON value representing the alarm rule.")
                                             @RequestBody AlarmRuleDefinition alarmRuleDefinition) throws Exception {
        alarmRuleDefinition.setTenantId(getTenantId());
        checkEntityId(alarmRuleDefinition.getEntityId(), Operation.WRITE_CALCULATED_FIELD);
        CalculatedField calculatedField = alarmRuleDefinition.toCalculatedField();
        calculatedFieldController.checkReferencedEntities(calculatedField.getConfiguration());
        CalculatedField saved = tbCalculatedFieldService.save(calculatedField, getCurrentUser());
        return AlarmRuleDefinition.fromCalculatedField(saved);
    }

    @ApiOperation(value = "Get Alarm Rule (getAlarmRuleById)",
            notes = "Fetch the Alarm Rule object based on the provided Alarm Rule Id." + TENANT_AUTHORITY_PARAGRAPH)
    @PreAuthorize("hasAuthority('TENANT_ADMIN')")
    @GetMapping("/alarm/rule/{alarmRuleId}")
    public AlarmRuleDefinition getAlarmRuleById(@Parameter @PathVariable(ALARM_RULE_ID) String strAlarmRuleId) throws ThingsboardException {
        checkParameter(ALARM_RULE_ID, strAlarmRuleId);
        CalculatedFieldId calculatedFieldId = new CalculatedFieldId(toUUID(strAlarmRuleId));
        CalculatedField calculatedField = tbCalculatedFieldService.findById(calculatedFieldId, getCurrentUser());
        checkNotNull(calculatedField);
        checkEntityId(calculatedField.getEntityId(), Operation.READ_CALCULATED_FIELD);
        return AlarmRuleDefinition.fromCalculatedField(calculatedField);
    }

    @ApiOperation(value = "Get Alarm Rules by Entity Id (getAlarmRulesByEntityId)",
            notes = "Fetch the Alarm Rules based on the provided Entity Id." + TENANT_AUTHORITY_PARAGRAPH)
    @PreAuthorize("hasAuthority('TENANT_ADMIN')")
    @GetMapping(value = "/alarm/rules/{entityType}/{entityId}")
    public PageData<AlarmRuleDefinition> getAlarmRulesByEntityId(
            @Parameter(description = ENTITY_TYPE_PARAM_DESCRIPTION, required = true, schema = @Schema(defaultValue = "DEVICE")) @PathVariable("entityType") String entityType,
            @Parameter(description = ENTITY_ID_PARAM_DESCRIPTION, required = true) @PathVariable("entityId") String entityIdStr,
            @Parameter(description = PAGE_SIZE_DESCRIPTION, required = true) @RequestParam int pageSize,
            @Parameter(description = PAGE_NUMBER_DESCRIPTION, required = true) @RequestParam int page,
            @Parameter(description = CF_TEXT_SEARCH_DESCRIPTION) @RequestParam(required = false) String textSearch,
            @Parameter(description = SORT_PROPERTY_DESCRIPTION, schema = @Schema(allowableValues = {"createdTime", "name"})) @RequestParam(required = false) String sortProperty,
            @Parameter(description = SORT_ORDER_DESCRIPTION, schema = @Schema(allowableValues = {"ASC", "DESC"})) @RequestParam(required = false) String sortOrder) throws ThingsboardException {
        PageLink pageLink = createPageLink(pageSize, page, textSearch, sortProperty, sortOrder);
        checkParameter("entityId", entityIdStr);
        EntityId entityId = EntityIdFactory.getByTypeAndUuid(entityType, entityIdStr);
        checkEntityId(entityId, Operation.READ_CALCULATED_FIELD);
        PageData<CalculatedField> result = checkNotNull(tbCalculatedFieldService.findByTenantIdAndEntityId(getTenantId(), entityId, CalculatedFieldType.ALARM, pageLink));
        return result.mapData(AlarmRuleDefinition::fromCalculatedField);
    }

    @ApiOperation(value = "Get alarm rules (getAlarmRules)",
            notes = "Fetch tenant alarm rules based on the filter." + TENANT_AUTHORITY_PARAGRAPH)
    @PreAuthorize("hasAuthority('TENANT_ADMIN')")
    @GetMapping(value = "/alarm/rules")
    public PageData<AlarmRuleDefinitionInfo> getAlarmRules(@Parameter(description = PAGE_SIZE_DESCRIPTION, required = true)
                                                           @RequestParam int pageSize,
                                                           @Parameter(description = PAGE_NUMBER_DESCRIPTION, required = true)
                                                           @RequestParam int page,
                                                           @Parameter(description = "Entity type filter. If not specified, alarm rules for all supported entity types will be returned.")
                                                           @RequestParam(required = false) EntityType entityType,
                                                           @Parameter(description = "Entities filter. If not specified, alarm rules for entity type filter will be returned.")
                                                           @RequestParam(required = false) Set<UUID> entities,
                                                           @Parameter(description = CF_TEXT_SEARCH_DESCRIPTION)
                                                           @RequestParam(required = false) String textSearch,
                                                           @Parameter(description = SORT_PROPERTY_DESCRIPTION, schema = @Schema(allowableValues = {"createdTime", "name"}))
                                                           @RequestParam(required = false) String sortProperty,
                                                           @Parameter(description = SORT_ORDER_DESCRIPTION, schema = @Schema(allowableValues = {"ASC", "DESC"}))
                                                           @RequestParam(required = false) String sortOrder) throws ThingsboardException {
        PageLink pageLink = createPageLink(pageSize, page, textSearch, sortProperty, sortOrder);
        SecurityUser user = getCurrentUser();

        Set<CalculatedFieldType> types = EnumSet.of(CalculatedFieldType.ALARM);

        Set<EntityType> entityTypes;
        if (entityType == null) {
            entityTypes = CalculatedField.SUPPORTED_ENTITIES.entrySet().stream()
                    .filter(entry -> CollectionUtils.containsAny(entry.getValue(), types))
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toSet());
        } else {
            entityTypes = EnumSet.of(entityType);
        }

        CalculatedFieldFilter filter = CalculatedFieldFilter.builder()
                .types(types)
                .entityTypes(entityTypes)
                .entityIds(entities)
                .build();
        PageData<CalculatedFieldInfo> result = calculatedFieldService.findCalculatedFieldsByTenantIdAndFilter(user.getTenantId(), filter, pageLink);
        return result.mapData(AlarmRuleDefinitionInfo::fromCalculatedFieldInfo);
    }

    @ApiOperation(value = "Get alarm rule names (getAlarmRuleNames)",
            notes = "Fetch the list of alarm rule names." + TENANT_AUTHORITY_PARAGRAPH)
    @PreAuthorize("hasAuthority('TENANT_ADMIN')")
    @GetMapping(value = "/alarm/rules/names")
    public PageData<String> getAlarmRuleNames(@Parameter(description = PAGE_SIZE_DESCRIPTION, required = true)
                                              @RequestParam int pageSize,
                                              @Parameter(description = PAGE_NUMBER_DESCRIPTION, required = true)
                                              @RequestParam int page,
                                              @Parameter(description = CF_TEXT_SEARCH_DESCRIPTION)
                                              @RequestParam(required = false) String textSearch,
                                              @Parameter(description = SORT_ORDER_DESCRIPTION, schema = @Schema(allowableValues = {"ASC", "DESC"}))
                                              @RequestParam(required = false) String sortOrder) throws ThingsboardException {
        PageLink pageLink = createPageLink(pageSize, page, textSearch, "name", sortOrder);
        return calculatedFieldService.findCalculatedFieldNamesByTenantIdAndType(getTenantId(), CalculatedFieldType.ALARM, pageLink);
    }

    @ApiOperation(value = "Delete Alarm Rule (deleteAlarmRule)",
            notes = "Deletes the alarm rule. Referencing non-existing Alarm Rule Id will cause an error." + TENANT_AUTHORITY_PARAGRAPH)
    @PreAuthorize("hasAuthority('TENANT_ADMIN')")
    @DeleteMapping("/alarm/rule/{alarmRuleId}")
    @ResponseStatus(HttpStatus.OK)
    public void deleteAlarmRule(@PathVariable(ALARM_RULE_ID) String strAlarmRuleId) throws Exception {
        checkParameter(ALARM_RULE_ID, strAlarmRuleId);
        CalculatedFieldId calculatedFieldId = new CalculatedFieldId(toUUID(strAlarmRuleId));
        CalculatedField calculatedField = tbCalculatedFieldService.findById(calculatedFieldId, getCurrentUser());
        checkEntityId(calculatedField.getEntityId(), Operation.WRITE_CALCULATED_FIELD);
        tbCalculatedFieldService.delete(calculatedField, getCurrentUser());
    }

    @ApiOperation(value = "Get latest alarm rule debug event (getLatestAlarmRuleDebugEvent)",
            notes = "Gets latest alarm rule debug event for specified alarm rule id. " +
                    "Referencing non-existing alarm rule id will cause an error. " + TENANT_AUTHORITY_PARAGRAPH)
    @PreAuthorize("hasAuthority('TENANT_ADMIN')")
    @GetMapping("/alarm/rule/{alarmRuleId}/debug")
    public JsonNode getLatestAlarmRuleDebugEvent(@Parameter @PathVariable(ALARM_RULE_ID) String strAlarmRuleId) throws ThingsboardException {
        checkParameter(ALARM_RULE_ID, strAlarmRuleId);
        CalculatedFieldId calculatedFieldId = new CalculatedFieldId(toUUID(strAlarmRuleId));
        CalculatedField calculatedField = tbCalculatedFieldService.findById(calculatedFieldId, getCurrentUser());
        checkEntityId(calculatedField.getEntityId(), Operation.READ_CALCULATED_FIELD);
        TenantId tenantId = getCurrentUser().getTenantId();
        return Optional.ofNullable(eventService.findLatestEvents(tenantId, calculatedFieldId, EventType.DEBUG_CALCULATED_FIELD, 1))
                .flatMap(events -> events.stream().map(EventInfo::getBody).findFirst())
                .orElse(null);
    }

    @ApiOperation(value = "Test alarm rule TBEL expression (testAlarmRuleScript)",
            notes = TEST_SCRIPT_EXPRESSION + TENANT_AUTHORITY_PARAGRAPH)
    @PreAuthorize("hasAuthority('TENANT_ADMIN')")
    @PostMapping("/alarm/rule/testScript")
    public JsonNode testAlarmRuleScript(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Test alarm rule TBEL condition expression. The expression must return a boolean value.")
            @RequestBody JsonNode inputParams) {
        String expression = inputParams.get("expression").asText();
        Map<String, TbelCfArg> arguments = Objects.requireNonNullElse(
                JacksonUtil.convertValue(inputParams.get("arguments"), new TypeReference<>() {}),
                Collections.emptyMap()
        );

        ArrayList<String> ctxAndArgNames = new ArrayList<>(arguments.size() + 1);
        ctxAndArgNames.add("ctx");
        ctxAndArgNames.addAll(arguments.keySet());

        String output = "";
        String errorText = "";

        CalculatedFieldTbelScriptEngine engine = null;
        try {
            if (tbelInvokeService == null) {
                throw new IllegalArgumentException("TBEL script engine is disabled!");
            }

            engine = new CalculatedFieldTbelScriptEngine(
                    getTenantId(),
                    tbelInvokeService,
                    expression,
                    ctxAndArgNames.toArray(String[]::new)
            );

            Object[] args = new Object[ctxAndArgNames.size()];
            args[0] = new TbelCfCtx(arguments, CalculatedFieldController.getLatestTimestamp(arguments));
            for (int i = 1; i < ctxAndArgNames.size(); i++) {
                var arg = arguments.get(ctxAndArgNames.get(i));
                if (arg instanceof TbelCfSingleValueArg svArg) {
                    args[i] = svArg.getValue();
                } else {
                    args[i] = arg;
                }
            }

            JsonNode json = engine.executeJsonAsync(args).get(TIMEOUT, TimeUnit.SECONDS);
            output = JacksonUtil.toString(json);
        } catch (Exception e) {
            log.error("Error evaluating expression", e);
            Throwable rootCause = ExceptionUtils.getRootCause(e);
            errorText = ObjectUtils.firstNonNull(rootCause.getMessage(), e.getMessage(), e.getClass().getSimpleName());
        } finally {
            if (engine != null) {
                engine.destroy();
            }
        }
        return JacksonUtil.newObjectNode()
                .put("output", output)
                .put("error", errorText);
    }

}
