# Alarm Rule Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated AlarmRuleController REST API that wraps the CalculatedField service layer, hiding the CF implementation detail from alarm rule API consumers.

**Architecture:** Thin controller wrapper. New `AlarmRuleDefinition` and `AlarmRuleDefinitionInfo` DTOs wrap `CalculatedField`/`CalculatedFieldInfo`. `AlarmRuleController` delegates to `TbCalculatedFieldService` and `CalculatedFieldService` (DAO). UI gets a new `AlarmRulesService` pointing at the new endpoints. `AlarmRulesTest` switches to the new API.

**Tech Stack:** Java 17+, Spring Boot, Angular 17+, JUnit 4 / Spring MockMvc

---

## File Structure

**Backend (new):**
- `common/data/src/main/java/org/thingsboard/server/common/data/cf/AlarmRuleDefinition.java` — DTO wrapping CalculatedField without `type`
- `common/data/src/main/java/org/thingsboard/server/common/data/cf/AlarmRuleDefinitionInfo.java` — extends AlarmRuleDefinition, adds `entityName`
- `application/src/main/java/org/thingsboard/server/controller/AlarmRuleController.java` — REST controller

**Backend (modify):**
- `application/src/test/java/org/thingsboard/server/controller/AbstractWebTest.java:1652` — add `saveAlarmRule()` helper alongside existing `saveCalculatedField()`
- `application/src/test/java/org/thingsboard/server/cf/AlarmRulesTest.java` — switch from CF API to alarm rule API

**Frontend (new):**
- `ui-ngx/src/app/core/http/alarm-rules.service.ts` — Angular HTTP service for alarm rule endpoints

**Frontend (modify):**
- `ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rule-dialog.component.ts` — switch from `CalculatedFieldsService` to `AlarmRulesService`
- `ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rules-table.component.ts` — inject `AlarmRulesService` instead of `CalculatedFieldsService`
- `ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rules-table-config.ts` — use `AlarmRulesService` for all CRUD operations

---

### Task 1: Create AlarmRuleDefinition DTO

**Files:**
- Create: `common/data/src/main/java/org/thingsboard/server/common/data/cf/AlarmRuleDefinition.java`

- [ ] **Step 1: Create AlarmRuleDefinition class**

```java
package org.thingsboard.server.common.data.cf;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.thingsboard.server.common.data.BaseData;
import org.thingsboard.server.common.data.HasAdditionalInfo;
import org.thingsboard.server.common.data.HasDebugSettings;
import org.thingsboard.server.common.data.HasName;
import org.thingsboard.server.common.data.HasVersion;
import org.thingsboard.server.common.data.TenantEntity;
import org.thingsboard.server.common.data.EntityType;
import org.thingsboard.server.common.data.cf.configuration.AlarmCalculatedFieldConfiguration;
import org.thingsboard.server.common.data.debug.DebugSettings;
import org.thingsboard.server.common.data.id.CalculatedFieldId;
import org.thingsboard.server.common.data.id.EntityId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.validation.Length;
import org.thingsboard.server.common.data.validation.NoXss;

@Schema
@Data
@EqualsAndHashCode(callSuper = true)
public class AlarmRuleDefinition extends BaseData<CalculatedFieldId> implements HasName, TenantEntity, HasVersion, HasDebugSettings, HasAdditionalInfo {

    private TenantId tenantId;
    private EntityId entityId;

    @NoXss
    @Length(fieldName = "name")
    @Schema(description = "Alarm type name.")
    private String name;
    @Deprecated
    @Schema(description = "Enable/disable debug.", example = "false", deprecated = true)
    private boolean debugMode;
    @Schema(description = "Debug settings object.")
    private DebugSettings debugSettings;
    @Schema(description = "Version of alarm rule configuration.", example = "0")
    private int configurationVersion;
    @Schema(implementation = AlarmCalculatedFieldConfiguration.class)
    @Valid
    @NotNull
    private AlarmCalculatedFieldConfiguration configuration;
    private Long version;
    @NoXss
    @Schema(description = "Additional parameters of the alarm rule")
    private JsonNode additionalInfo;

    public AlarmRuleDefinition() {}

    public AlarmRuleDefinition(CalculatedFieldId id) {
        super(id);
    }

    public AlarmRuleDefinition(AlarmRuleDefinition other) {
        super(other);
        this.tenantId = other.tenantId;
        this.entityId = other.entityId;
        this.name = other.name;
        this.debugMode = other.debugMode;
        this.debugSettings = other.debugSettings;
        this.configurationVersion = other.configurationVersion;
        this.configuration = other.configuration;
        this.version = other.version;
        this.additionalInfo = other.additionalInfo;
    }

    @Schema(description = "JSON object with the Alarm Rule Id.")
    @Override
    public CalculatedFieldId getId() {
        return super.getId();
    }

    @Schema(description = "Timestamp of the alarm rule creation, in milliseconds", example = "1609459200000", accessMode = Schema.AccessMode.READ_ONLY)
    @Override
    public long getCreatedTime() {
        return super.getCreatedTime();
    }

    @JsonIgnore
    public boolean isDebugMode() {
        return debugMode;
    }

    @JsonSetter
    public void setDebugMode(boolean debugMode) {
        this.debugMode = debugMode;
    }

    @Override
    public EntityType getEntityType() {
        return EntityType.CALCULATED_FIELD;
    }

    public CalculatedField toCalculatedField() {
        CalculatedField cf = new CalculatedField();
        cf.setId(this.getId());
        cf.setCreatedTime(this.getCreatedTime());
        cf.setTenantId(this.tenantId);
        cf.setEntityId(this.entityId);
        cf.setType(CalculatedFieldType.ALARM);
        cf.setName(this.name);
        cf.setDebugMode(this.debugMode);
        cf.setDebugSettings(this.debugSettings);
        cf.setConfigurationVersion(this.configurationVersion);
        cf.setConfiguration(this.configuration);
        cf.setVersion(this.version);
        cf.setAdditionalInfo(this.additionalInfo);
        return cf;
    }

    public static AlarmRuleDefinition fromCalculatedField(CalculatedField cf) {
        AlarmRuleDefinition def = new AlarmRuleDefinition();
        def.setId(cf.getId());
        def.setCreatedTime(cf.getCreatedTime());
        def.setTenantId(cf.getTenantId());
        def.setEntityId(cf.getEntityId());
        def.setName(cf.getName());
        def.setDebugMode(cf.isDebugMode());
        def.setDebugSettings(cf.getDebugSettings());
        def.setConfigurationVersion(cf.getConfigurationVersion());
        def.setConfiguration((AlarmCalculatedFieldConfiguration) cf.getConfiguration());
        def.setVersion(cf.getVersion());
        def.setAdditionalInfo(cf.getAdditionalInfo());
        return def;
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/viacheslav/Desktop/thingsboard-pe && mvn compile -pl common/data -am -q -DskipTests 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add common/data/src/main/java/org/thingsboard/server/common/data/cf/AlarmRuleDefinition.java
git commit -m "Add AlarmRuleDefinition DTO"
```

---

### Task 2: Create AlarmRuleDefinitionInfo DTO

**Files:**
- Create: `common/data/src/main/java/org/thingsboard/server/common/data/cf/AlarmRuleDefinitionInfo.java`

- [ ] **Step 1: Create AlarmRuleDefinitionInfo class**

```java
package org.thingsboard.server.common.data.cf;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
public class AlarmRuleDefinitionInfo extends AlarmRuleDefinition {

    private String entityName;

    public AlarmRuleDefinitionInfo(AlarmRuleDefinition alarmRuleDefinition, String entityName) {
        super(alarmRuleDefinition);
        this.entityName = entityName;
    }

    public static AlarmRuleDefinitionInfo fromCalculatedFieldInfo(CalculatedFieldInfo cfi) {
        AlarmRuleDefinitionInfo info = new AlarmRuleDefinitionInfo();
        AlarmRuleDefinition def = AlarmRuleDefinition.fromCalculatedField(cfi);
        info.setId(def.getId());
        info.setCreatedTime(def.getCreatedTime());
        info.setTenantId(def.getTenantId());
        info.setEntityId(def.getEntityId());
        info.setName(def.getName());
        info.setDebugMode(def.isDebugMode());
        info.setDebugSettings(def.getDebugSettings());
        info.setConfigurationVersion(def.getConfigurationVersion());
        info.setConfiguration(def.getConfiguration());
        info.setVersion(def.getVersion());
        info.setAdditionalInfo(def.getAdditionalInfo());
        info.setEntityName(cfi.getEntityName());
        return info;
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/viacheslav/Desktop/thingsboard-pe && mvn compile -pl common/data -am -q -DskipTests 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add common/data/src/main/java/org/thingsboard/server/common/data/cf/AlarmRuleDefinitionInfo.java
git commit -m "Add AlarmRuleDefinitionInfo DTO"
```

---

### Task 3: Create AlarmRuleController

**Files:**
- Create: `application/src/main/java/org/thingsboard/server/controller/AlarmRuleController.java`

- [ ] **Step 1: Create the controller with all endpoints**

```java
package org.thingsboard.server.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.HttpStatus;
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
import org.thingsboard.script.api.tbel.TbelCfTsDoubleVal;
import org.thingsboard.script.api.tbel.TbelCfTsRollingArg;
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
import org.thingsboard.server.common.data.permission.Operation;
import org.thingsboard.server.common.data.permission.Resource;
import org.thingsboard.server.config.annotations.ApiOperation;
import org.thingsboard.server.dao.event.EventService;
import org.thingsboard.server.queue.util.TbCoreComponent;
import org.thingsboard.server.service.cf.ctx.state.CalculatedFieldTbelScriptEngine;
import org.thingsboard.server.service.entitiy.cf.TbCalculatedFieldService;
import org.thingsboard.server.service.security.model.SecurityUser;

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
    private final EventService eventService;
    private final TbelInvokeService tbelInvokeService;

    private static final String ALARM_RULE_ID = "alarmRuleId";
    private static final int TIMEOUT = 20;

    private static final String TEST_SCRIPT_EXPRESSION =
            "Execute the Script expression and return the result. The format of request: \n\n"
            + MARKDOWN_CODE_BLOCK_START
            + "{\n" +
            "  \"expression\": \"var temp = 0; foreach(element: temperature.values) {temp += element.value;} var avgTemperature = temp / temperature.values.size(); var adjustedTemperature = avgTemperature + 0.1 * humidity.value; return {\\\"adjustedTemperature\\\": adjustedTemperature};\",\n" +
            "  \"arguments\": {\n" +
            "    \"temperature\": {\n" +
            "      \"type\": \"TS_ROLLING\",\n" +
            "      \"timeWindow\": {\n" +
            "        \"startTs\": 1739775630002,\n" +
            "        \"endTs\": 65432211,\n" +
            "        \"limit\": 5\n" +
            "      },\n" +
            "      \"values\": [\n" +
            "        { \"ts\": 1739775639851, \"value\": 23 },\n" +
            "        { \"ts\": 1739775664561, \"value\": 43 },\n" +
            "        { \"ts\": 1739775713079, \"value\": 15 },\n" +
            "        { \"ts\": 1739775999522, \"value\": 34 },\n" +
            "        { \"ts\": 1739776228452, \"value\": 22 }\n" +
            "      ]\n" +
            "    },\n" +
            "    \"humidity\": { \"type\": \"SINGLE_VALUE\", \"ts\": 1739776478057, \"value\": 23 }\n" +
            "  }\n" +
            "}"
            + MARKDOWN_CODE_BLOCK_END
            + "\n\n Expected result JSON contains \"output\" and \"error\".";

    @ApiOperation(value = "Create Or Update Alarm Rule (saveAlarmRule)",
            notes = "Creates or Updates the Alarm Rule. When creating, platform generates Alarm Rule Id as " + UUID_WIKI_LINK +
                    "The newly created Alarm Rule Id will be present in the response. " +
                    "Specify existing Alarm Rule Id to update. " +
                    "Referencing non-existing Alarm Rule Id will cause 'Not Found' error. " +
                    "Remove 'id', 'tenantId' from the request body example (below) to create new Alarm Rule entity. "
                    + TENANT_AUTHORITY_PARAGRAPH)
    @PreAuthorize("hasAuthority('TENANT_ADMIN')")
    @PostMapping("/alarm/rule")
    public AlarmRuleDefinition saveAlarmRule(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "A JSON value representing the alarm rule.")
            @RequestBody AlarmRuleDefinition alarmRuleDefinition) throws Exception {
        alarmRuleDefinition.setTenantId(getTenantId());
        CalculatedField calculatedField = alarmRuleDefinition.toCalculatedField();
        checkEntityId(calculatedField.getEntityId(), Operation.WRITE_CALCULATED_FIELD);
        checkReferencedEntities(calculatedField);
        CalculatedField saved = tbCalculatedFieldService.save(calculatedField, getCurrentUser());
        return AlarmRuleDefinition.fromCalculatedField(saved);
    }

    @ApiOperation(value = "Get Alarm Rule (getAlarmRuleById)",
            notes = "Fetch the Alarm Rule object based on the provided Alarm Rule Id." + TENANT_AUTHORITY_PARAGRAPH)
    @PreAuthorize("hasAuthority('TENANT_ADMIN')")
    @GetMapping("/alarm/rule/{alarmRuleId}")
    public AlarmRuleDefinition getAlarmRuleById(
            @Parameter @PathVariable(ALARM_RULE_ID) String strAlarmRuleId) throws ThingsboardException {
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
    @GetMapping("/alarm/rule/{entityType}/{entityId}")
    public PageData<AlarmRuleDefinition> getAlarmRulesByEntityId(
            @Parameter(description = ENTITY_TYPE_PARAM_DESCRIPTION, required = true, schema = @Schema(defaultValue = "DEVICE")) @PathVariable("entityType") String entityType,
            @Parameter(description = ENTITY_ID_PARAM_DESCRIPTION, required = true) @PathVariable("entityId") String entityIdStr,
            @Parameter(description = PAGE_SIZE_DESCRIPTION, required = true) @RequestParam int pageSize,
            @Parameter(description = PAGE_NUMBER_DESCRIPTION, required = true) @RequestParam int page,
            @Parameter(description = "Filter by alarm rule name.") @RequestParam(required = false) String textSearch,
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
    @GetMapping("/alarm/rules")
    public PageData<AlarmRuleDefinitionInfo> getAlarmRules(
            @Parameter(description = PAGE_SIZE_DESCRIPTION, required = true) @RequestParam int pageSize,
            @Parameter(description = PAGE_NUMBER_DESCRIPTION, required = true) @RequestParam int page,
            @Parameter(description = "Entity type filter.") @RequestParam(required = false) EntityType entityType,
            @Parameter(description = "Entities filter.") @RequestParam(required = false) Set<UUID> entities,
            @Parameter(description = "Filter by alarm rule name.") @RequestParam(required = false) String textSearch,
            @Parameter(description = SORT_PROPERTY_DESCRIPTION, schema = @Schema(allowableValues = {"createdTime", "name"})) @RequestParam(required = false) String sortProperty,
            @Parameter(description = SORT_ORDER_DESCRIPTION, schema = @Schema(allowableValues = {"ASC", "DESC"})) @RequestParam(required = false) String sortOrder) throws ThingsboardException {
        PageLink pageLink = createPageLink(pageSize, page, textSearch, sortProperty, sortOrder);
        SecurityUser user = getCurrentUser();

        Set<CalculatedFieldType> types = EnumSet.of(CalculatedFieldType.ALARM);

        Set<EntityType> entityTypes;
        if (entityType == null) {
            entityTypes = CalculatedField.SUPPORTED_ENTITIES.entrySet().stream()
                    .filter(entry -> entry.getValue().contains(CalculatedFieldType.ALARM))
                    .map(Map.Entry::getKey)
                    .filter(t -> {
                        try {
                            return accessControlService.hasPermission(user, Resource.resourceFromEntityType(t), Operation.READ_CALCULATED_FIELD);
                        } catch (ThingsboardException e) {
                            return false;
                        }
                    })
                    .collect(Collectors.toSet());
        } else {
            accessControlService.checkPermission(user, Resource.resourceFromEntityType(entityType), Operation.READ_CALCULATED_FIELD);
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
    @GetMapping("/alarm/rules/names")
    public PageData<String> getAlarmRuleNames(
            @Parameter(description = PAGE_SIZE_DESCRIPTION, required = true) @RequestParam int pageSize,
            @Parameter(description = PAGE_NUMBER_DESCRIPTION, required = true) @RequestParam int page,
            @Parameter(description = "Filter by alarm rule name.") @RequestParam(required = false) String textSearch,
            @Parameter(description = SORT_ORDER_DESCRIPTION, schema = @Schema(allowableValues = {"ASC", "DESC"})) @RequestParam(required = false) String sortOrder) throws ThingsboardException {
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
    public JsonNode getLatestAlarmRuleDebugEvent(
            @Parameter @PathVariable(ALARM_RULE_ID) String strAlarmRuleId) throws ThingsboardException {
        checkParameter(ALARM_RULE_ID, strAlarmRuleId);
        CalculatedFieldId calculatedFieldId = new CalculatedFieldId(toUUID(strAlarmRuleId));
        CalculatedField calculatedField = tbCalculatedFieldService.findById(calculatedFieldId, getCurrentUser());
        checkEntityId(calculatedField.getEntityId(), Operation.READ_CALCULATED_FIELD);
        TenantId tenantId = getCurrentUser().getTenantId();
        return Optional.ofNullable(eventService.findLatestEvents(tenantId, calculatedFieldId, EventType.DEBUG_CALCULATED_FIELD, 1))
                .flatMap(events -> events.stream().map(EventInfo::getBody).findFirst())
                .orElse(null);
    }

    @ApiOperation(value = "Test Script expression",
            notes = TEST_SCRIPT_EXPRESSION + TENANT_AUTHORITY_PARAGRAPH)
    @PreAuthorize("hasAuthority('TENANT_ADMIN')")
    @PostMapping("/alarm/rule/testScript")
    public JsonNode testAlarmRuleScript(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Test alarm rule TBEL expression.")
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
            args[0] = new TbelCfCtx(arguments, getLatestTimestamp(arguments));
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

    private long getLatestTimestamp(Map<String, TbelCfArg> arguments) {
        long lastUpdateTimestamp = -1;
        for (TbelCfArg entry : arguments.values()) {
            if (entry instanceof TbelCfSingleValueArg singleValueArg) {
                long ts = singleValueArg.getTs();
                lastUpdateTimestamp = Math.max(lastUpdateTimestamp, ts);
            } else if (entry instanceof TbelCfTsRollingArg tsRollingArg) {
                long maxTs = tsRollingArg.getValues().stream().mapToLong(TbelCfTsDoubleVal::getTs).max().orElse(-1);
                lastUpdateTimestamp = Math.max(lastUpdateTimestamp, maxTs);
            }
        }
        return lastUpdateTimestamp == -1 ? System.currentTimeMillis() : lastUpdateTimestamp;
    }

    private void checkReferencedEntities(CalculatedField calculatedField) throws ThingsboardException {
        Set<EntityId> referencedEntityIds = calculatedField.getConfiguration().getReferencedEntities();
        for (EntityId referencedEntityId : referencedEntityIds) {
            EntityType refEntityType = referencedEntityId.getEntityType();
            switch (refEntityType) {
                case TENANT -> {
                    return;
                }
                case CUSTOMER, ASSET, DEVICE -> checkEntityId(referencedEntityId, Operation.READ);
                default -> throw new IllegalArgumentException("Alarm rules do not support '" + refEntityType + "' for referenced entities.");
            }
        }
    }
}
```

- [ ] **Step 2: Check that `PageData.mapData` exists**

The controller uses `result.mapData(...)` to convert page results. Verify this method exists:

Run: `cd /Users/viacheslav/Desktop/thingsboard-pe && grep -n 'mapData' common/data/src/main/java/org/thingsboard/server/common/data/page/PageData.java`

If `mapData` doesn't exist, replace with manual conversion:
```java
new PageData<>(result.getData().stream().map(AlarmRuleDefinition::fromCalculatedField).toList(), result.getTotalPages(), result.getTotalElements(), result.hasNext())
```

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/viacheslav/Desktop/thingsboard-pe && mvn compile -pl application -am -q -DskipTests 2>&1 | tail -10`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add application/src/main/java/org/thingsboard/server/controller/AlarmRuleController.java
git commit -m "Add AlarmRuleController with all endpoints"
```

---

### Task 4: Update AlarmRulesTest to use new API

**Files:**
- Modify: `application/src/test/java/org/thingsboard/server/controller/AbstractWebTest.java:1652`
- Modify: `application/src/test/java/org/thingsboard/server/cf/AlarmRulesTest.java`

- [ ] **Step 1: Add `saveAlarmRule` helper to AbstractWebTest**

In `application/src/test/java/org/thingsboard/server/controller/AbstractWebTest.java`, after the existing `saveCalculatedField` method at line 1652-1654, add:

```java
    protected AlarmRuleDefinition saveAlarmRule(AlarmRuleDefinition alarmRule) {
        return doPost("/api/alarm/rule", alarmRule, AlarmRuleDefinition.class);
    }
```

Also add the necessary import at the top of AbstractWebTest.java:
```java
import org.thingsboard.server.common.data.cf.AlarmRuleDefinition;
```

- [ ] **Step 2: Update AlarmRulesTest imports**

In `application/src/test/java/org/thingsboard/server/cf/AlarmRulesTest.java`, add the import:

```java
import org.thingsboard.server.common.data.cf.AlarmRuleDefinition;
```

- [ ] **Step 3: Update `createAlarmCf` to `createAlarmRule` using new DTO**

Replace the `createAlarmCf` method (starting at line 955) with:

```java
    private AlarmRuleDefinition createAlarmRule(EntityId entityId,
                                                String alarmType,
                                                Map<String, Argument> arguments,
                                                Map<AlarmSeverity, Condition> createConditions,
                                                Condition clearCondition,
                                                Consumer<AlarmCalculatedFieldConfiguration>... modifier) {
        Map<AlarmSeverity, AlarmRule> createRules = new HashMap<>();
        createConditions.forEach((severity, condition) -> {
            createRules.put(severity, toAlarmRule(condition));
        });
        AlarmRule clearRule = clearCondition != null ? toAlarmRule(clearCondition) : null;

        AlarmRuleDefinition alarmRuleDefinition = new AlarmRuleDefinition();
        alarmRuleDefinition.setEntityId(entityId);
        alarmRuleDefinition.setName(alarmType);
        AlarmCalculatedFieldConfiguration configuration = new AlarmCalculatedFieldConfiguration();
        configuration.setArguments(arguments);
        configuration.setCreateRules(createRules);
        configuration.setClearRule(clearRule);
        alarmRuleDefinition.setConfiguration(configuration);
        alarmRuleDefinition.setDebugSettings(DebugSettings.all());
        if (modifier.length > 0) {
            modifier[0].accept(configuration);
        }
        AlarmRuleDefinition saved = saveAlarmRule(alarmRuleDefinition);

        CalculatedFieldDebugEvent debugEvent = await().atMost(TIMEOUT, TimeUnit.SECONDS)
                .until(() -> getDebugEvents(saved.getId(), 1),
                        events -> !events.isEmpty()).get(0);
        latestEventId = debugEvent.getId();
        return saved;
    }
```

- [ ] **Step 4: Update all test methods that call `createAlarmCf`**

Search and replace all occurrences of `createAlarmCf` with `createAlarmRule` in AlarmRulesTest.java. Also update the local variable type from `CalculatedField` to `AlarmRuleDefinition` wherever the return value of `createAlarmRule` is stored. For example, change:

```java
CalculatedField calculatedField = createAlarmCf(deviceId, "High Temperature Alarm", arguments, createRules, clearRule);
```

to:

```java
AlarmRuleDefinition alarmRule = createAlarmRule(deviceId, "High Temperature Alarm", arguments, createRules, clearRule);
```

Then update references from `calculatedField` to `alarmRule` in the assertion calls like `checkAlarmResult(calculatedField, ...)` → `checkAlarmResult(alarmRule, ...)`.

- [ ] **Step 5: Update `checkAlarmResult` to accept AlarmRuleDefinition**

The `checkAlarmResult` method currently takes `CalculatedField`. Update it to accept `AlarmRuleDefinition`:

```java
    private TbAlarmResult checkAlarmResult(AlarmRuleDefinition alarmRule, Consumer<TbAlarmResult> assertion) {
        return checkAlarmResult(alarmRule, assertion, null);
    }

    private TbAlarmResult checkAlarmResult(AlarmRuleDefinition alarmRule, Consumer<TbAlarmResult> assertion, Predicate<TbAlarmResult> waitFor) {
        TbAlarmResult alarmResult = await().atMost(TIMEOUT, TimeUnit.SECONDS)
                .until(() -> getLatestAlarmResult(alarmRule.getId()),
                        result -> result != null && (waitFor == null || waitFor.test(result)));
        assertion.accept(alarmResult);

        Alarm alarm = alarmResult.getAlarm();
        assertThat(alarm.getOriginator()).isEqualTo(originatorId);
        assertThat(alarm.getType()).isEqualTo(alarmRule.getName());
        return alarmResult;
    }
```

- [ ] **Step 6: Remove unused `CalculatedField` and `CalculatedFieldType` imports if no longer referenced**

After all changes, remove the import for `CalculatedFieldType` and `CalculatedField` from AlarmRulesTest if they are no longer used:

```java
// Remove if unused:
// import org.thingsboard.server.common.data.cf.CalculatedField;
// import org.thingsboard.server.common.data.cf.CalculatedFieldType;
```

Keep `CalculatedFieldId` import since it's still used by `getDebugEvents`.

- [ ] **Step 7: Verify test compilation**

Run: `cd /Users/viacheslav/Desktop/thingsboard-pe && mvn test-compile -pl application -am -q -DskipTests 2>&1 | tail -10`
Expected: BUILD SUCCESS

- [ ] **Step 8: Run AlarmRulesTest**

Run: `cd /Users/viacheslav/Desktop/thingsboard-pe && mvn test -pl application -Dtest="org.thingsboard.server.cf.AlarmRulesTest" -DfailIfNoTests=false 2>&1 | tail -30`
Expected: All tests pass. If any test fails, investigate and fix the variable name/type mismatches.

- [ ] **Step 9: Commit**

```bash
git add application/src/test/java/org/thingsboard/server/controller/AbstractWebTest.java
git add application/src/test/java/org/thingsboard/server/cf/AlarmRulesTest.java
git commit -m "Update AlarmRulesTest to use new alarm rule API"
```

---

### Task 5: Create UI AlarmRulesService

**Files:**
- Create: `ui-ngx/src/app/core/http/alarm-rules.service.ts`

- [ ] **Step 1: Create the service**

```typescript
///
/// ThingsBoard, Inc. ("COMPANY") CONFIDENTIAL
///
/// Copyright © 2016-2026 ThingsBoard, Inc. All Rights Reserved.
///
/// NOTICE: All information contained herein is, and remains
/// the property of ThingsBoard, Inc. and its suppliers,
/// if any.  The intellectual and technical concepts contained
/// herein are proprietary to ThingsBoard, Inc.
/// and its suppliers and may be covered by U.S. and Foreign Patents,
/// patents in process, and are protected by trade secret or copyright law.
///
/// Dissemination of this information or reproduction of this material is strictly forbidden
/// unless prior written permission is obtained from COMPANY.
///
/// Access to the source code contained herein is hereby forbidden to anyone except current COMPANY employees,
/// managers or contractors who have executed Confidentiality and Non-disclosure agreements
/// explicitly covering such access.
///
/// The copyright notice above does not evidence any actual or intended publication
/// or disclosure  of  this source code, which includes
/// information that is confidential and/or proprietary, and is a trade secret, of  COMPANY.
/// ANY REPRODUCTION, MODIFICATION, DISTRIBUTION, PUBLIC  PERFORMANCE,
/// OR PUBLIC DISPLAY OF OR THROUGH USE  OF THIS  SOURCE CODE  WITHOUT
/// THE EXPRESS WRITTEN CONSENT OF COMPANY IS STRICTLY PROHIBITED,
/// AND IN VIOLATION OF APPLICABLE LAWS AND INTERNATIONAL TREATIES.
/// THE RECEIPT OR POSSESSION OF THIS SOURCE CODE AND/OR RELATED INFORMATION
/// DOES NOT CONVEY OR IMPLY ANY RIGHTS TO REPRODUCE, DISCLOSE OR DISTRIBUTE ITS CONTENTS,
/// OR TO MANUFACTURE, USE, OR SELL ANYTHING THAT IT  MAY DESCRIBE, IN WHOLE OR IN PART.
///

import { Injectable } from '@angular/core';
import { defaultHttpOptionsFromConfig, defaultHttpOptionsFromParams, RequestConfig } from './http-utils';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { PageData } from '@shared/models/page/page-data';
import {
  CalculatedField,
  CalculatedFieldInfo,
  CalculatedFieldsQuery,
  CalculatedFieldTestScriptInputParams,
} from '@shared/models/calculated-field.models';
import { PageLink } from '@shared/models/page/page-link';
import { EntityId } from '@shared/models/id/entity-id';
import { EntityTestScriptResult } from '@shared/models/entity.models';
import { CalculatedFieldEventBody } from '@shared/models/event.models';

@Injectable({
  providedIn: 'root'
})
export class AlarmRulesService {

  constructor(
    private http: HttpClient
  ) { }

  public getAlarmRuleById(alarmRuleId: string, config?: RequestConfig): Observable<CalculatedField> {
    return this.http.get<CalculatedField>(`/api/alarm/rule/${alarmRuleId}`, defaultHttpOptionsFromConfig(config));
  }

  public saveAlarmRule(alarmRule: CalculatedField, config?: RequestConfig): Observable<CalculatedField> {
    return this.http.post<CalculatedField>('/api/alarm/rule', alarmRule, defaultHttpOptionsFromConfig(config));
  }

  public deleteAlarmRule(alarmRuleId: string, config?: RequestConfig): Observable<boolean> {
    return this.http.delete<boolean>(`/api/alarm/rule/${alarmRuleId}`, defaultHttpOptionsFromConfig(config));
  }

  public getAlarmRules(pageLink: PageLink, query: CalculatedFieldsQuery, config?: RequestConfig): Observable<PageData<CalculatedFieldInfo>> {
    return this.http.get<PageData<CalculatedFieldInfo>>(`/api/alarm/rules${pageLink.toQuery()}`, defaultHttpOptionsFromParams(query, config));
  }

  public getAlarmRulesByEntityId({ entityType, id }: EntityId, pageLink: PageLink, config?: RequestConfig): Observable<PageData<CalculatedField>> {
    return this.http.get<PageData<CalculatedField>>(`/api/alarm/rule/${entityType}/${id}${pageLink.toQuery()}`, defaultHttpOptionsFromConfig(config));
  }

  public testScript(inputParams: CalculatedFieldTestScriptInputParams, config?: RequestConfig): Observable<EntityTestScriptResult> {
    return this.http.post<EntityTestScriptResult>('/api/alarm/rule/testScript', inputParams, defaultHttpOptionsFromConfig(config));
  }

  public getLatestAlarmRuleDebugEvent(id: string, config?: RequestConfig): Observable<CalculatedFieldEventBody> {
    return this.http.get<CalculatedFieldEventBody>(`/api/alarm/rule/${id}/debug`, defaultHttpOptionsFromConfig(config));
  }

  public getAlarmRuleNames(pageLink: PageLink, config?: RequestConfig): Observable<PageData<string>> {
    return this.http.get<PageData<string>>(`/api/alarm/rules/names${pageLink.toQuery()}`, defaultHttpOptionsFromConfig(config));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add ui-ngx/src/app/core/http/alarm-rules.service.ts
git commit -m "Add AlarmRulesService for UI"
```

---

### Task 6: Update UI components to use AlarmRulesService

**Files:**
- Modify: `ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rules-table.component.ts`
- Modify: `ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rules-table-config.ts`
- Modify: `ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rule-dialog.component.ts`

- [ ] **Step 1: Update alarm-rules-table-config.ts**

In `ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rules-table-config.ts`:

1. Add import for `AlarmRulesService`:
```typescript
import { AlarmRulesService } from '@core/http/alarm-rules.service';
```

2. Change the constructor parameter type from `CalculatedFieldsService` to `AlarmRulesService` (line 105):
```typescript
constructor(private alarmRulesService: AlarmRulesService,
```

3. Update all service call sites. Replace:
   - `this.calculatedFieldsService.getCalculatedFieldById(id.id)` → `this.alarmRulesService.getAlarmRuleById(id.id)` (line 155)
   - `this.calculatedFieldsService.saveCalculatedField(alarmRule)` → `this.alarmRulesService.saveAlarmRule(alarmRule)` (line 156)
   - `this.calculatedFieldsService.deleteCalculatedField(id.id)` → `this.alarmRulesService.deleteAlarmRule(id.id)` (line 165)
   - `this.calculatedFieldsService.saveCalculatedField(calculatedField)` → `this.alarmRulesService.saveAlarmRule(calculatedField)` (line 393, in `importCalculatedField`)

4. Update `fetchCalculatedFields` method (line 248-252):
```typescript
  fetchCalculatedFields(pageLink: PageLink): Observable<PageData<AlarmRuleTableEntity>> {
    return this.pageMode ?
      this.alarmRulesService.getAlarmRules(pageLink, this.alarmRuleFilterConfig) :
      this.alarmRulesService.getAlarmRulesByEntityId(this.entityId, pageLink);
  }
```

Note: The `getAlarmRules` call no longer passes `types: [CalculatedFieldType.ALARM]` since the endpoint hardcodes that. The `alarmRuleFilterConfig` query object may still contain entity type filters which will be passed as query params.

5. Update `onDebugConfigChanged` method (line 414-419):
```typescript
  private onDebugConfigChanged(id: string, debugSettings: EntityDebugSettings): void {
    this.alarmRulesService.getAlarmRuleById(id).pipe(
      switchMap(field => this.alarmRulesService.saveAlarmRule({ ...field, debugSettings })),
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.updateData());
  }
```

6. Remove the `CalculatedFieldsService` import if it's no longer needed. Keep `CalculatedFieldType` import since it's still referenced in `importCalculatedField` for type validation check.

- [ ] **Step 2: Update alarm-rules-table.component.ts**

In `ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rules-table.component.ts`:

1. Replace `CalculatedFieldsService` import with `AlarmRulesService`:
```typescript
import { AlarmRulesService } from '@core/http/alarm-rules.service';
```

2. Change the injected service in the constructor from `CalculatedFieldsService` to `AlarmRulesService`:
```typescript
constructor(private alarmRulesService: AlarmRulesService,
```

3. Update the `AlarmRulesTableConfig` instantiation to pass `alarmRulesService` instead of `calculatedFieldsService`:
```typescript
this.alarmRulesTableConfig = new AlarmRulesTableConfig(
    this.alarmRulesService,
    // ... remaining parameters stay the same
);
```

- [ ] **Step 3: Update alarm-rule-dialog.component.ts**

In `ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rule-dialog.component.ts`:

1. Add import for `AlarmRulesService`:
```typescript
import { AlarmRulesService } from '@core/http/alarm-rules.service';
```

2. Change the constructor injection from `CalculatedFieldsService` to `AlarmRulesService`:
```typescript
private alarmRulesService: AlarmRulesService,
```

3. Update the `add()` method (around line 206) to use the new service:
```typescript
this.alarmRulesService.saveAlarmRule(alarmRule)
```

4. Remove the `CalculatedFieldsService` import if no longer used.

- [ ] **Step 4: Verify UI build**

Run: `cd /Users/viacheslav/Desktop/thingsboard-pe/ui-ngx && npx ng build --configuration production 2>&1 | tail -20`

If the build is slow, alternatively verify just type checking:
Run: `cd /Users/viacheslav/Desktop/thingsboard-pe/ui-ngx && npx tsc --noEmit 2>&1 | head -30`

Expected: No compilation errors.

- [ ] **Step 5: Commit**

```bash
git add ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rules-table-config.ts
git add ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rules-table.component.ts
git add ui-ngx/src/app/modules/home/components/alarm-rules/alarm-rule-dialog.component.ts
git commit -m "Switch UI alarm rule components to AlarmRulesService"
```
