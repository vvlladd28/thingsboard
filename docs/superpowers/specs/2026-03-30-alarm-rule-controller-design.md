# Alarm Rule Controller Design

## Problem

Alarm rules in ThingsBoard PE are internally implemented as calculated fields with `CalculatedFieldType.ALARM`. API consumers must create alarm rules via the `CalculatedFieldController`, setting `type = ALARM` — exposing an implementation detail that is confusing and leaks the CF abstraction.

## Goal

Create a dedicated `AlarmRuleController` that provides a clean, alarm-focused REST API while delegating to the existing `TbCalculatedFieldService` underneath. Update the UI and tests to use the new endpoints.

## Approach

Thin controller wrapper: `AlarmRuleController` delegates directly to `TbCalculatedFieldService`. A new `AlarmRuleDefinition` DTO wraps `CalculatedField` with the `type` field hidden (always ALARM). Conversion happens inline in the controller. No new service layer.

The existing `CalculatedFieldController` remains unchanged.

## DTOs

### AlarmRuleDefinition

Located in `common/data/src/main/java/org/thingsboard/server/common/data/cf/AlarmRuleDefinition.java`.

Same structure as `CalculatedField` but without the `type` field:

- `id`: `CalculatedFieldId` (reused, not a new ID type)
- `tenantId`: `TenantId`
- `name`: `String`
- `entityId`: `EntityId`
- `configuration`: `AlarmCalculatedFieldConfiguration`
- `createdTime`: `long`
- `configurationVersion`: `int`

Provides conversion methods:
- `toCalculatedField()` — sets `type = ALARM`, copies all fields
- `static fromCalculatedField(CalculatedField cf)` — strips `type`, copies all fields

### AlarmRuleDefinitionInfo

Extends `AlarmRuleDefinition`, adds `entityName: String`. Mirrors the `CalculatedFieldInfo` pattern.

Provides:
- `static fromCalculatedFieldInfo(CalculatedFieldInfo cfi)` — converts from the existing info type

## Controller

### AlarmRuleController

Located in `application/src/main/java/org/thingsboard/server/controller/AlarmRuleController.java`.

- `@RequestMapping("/api/alarm/rule")` for single-entity operations
- Extends `BaseController`
- Injects `TbCalculatedFieldService`, `EventService`, `TbelInvokeService`
- All endpoints require `TENANT_ADMIN` authority
- Uses existing `Operation.WRITE_CALCULATED_FIELD` / `READ_CALCULATED_FIELD` permissions

### Endpoints

| Method | Path | Description | Delegates To |
|--------|------|-------------|--------------|
| `POST` | `/api/alarm/rule` | Create or update alarm rule | `TbCalculatedFieldService.save()` |
| `GET` | `/api/alarm/rule/{alarmRuleId}` | Get alarm rule by ID | `TbCalculatedFieldService.findById()` |
| `GET` | `/api/alarm/rule/{entityType}/{entityId}` | Get alarm rules by entity (paged) | `TbCalculatedFieldService.findByTenantIdAndEntityId()` with `type=ALARM` |
| `GET` | `/api/alarm/rules` | List all alarm rules (paged, filtered) | `calculatedFieldService.findCalculatedFieldsByTenantIdAndFilter()` with `types={ALARM}` |
| `GET` | `/api/alarm/rules/names` | Get alarm rule names (paged) | `calculatedFieldService.findCalculatedFieldNamesByTenantIdAndType()` with `type=ALARM` |
| `DELETE` | `/api/alarm/rule/{alarmRuleId}` | Delete alarm rule | `TbCalculatedFieldService.delete()` |
| `GET` | `/api/alarm/rule/{alarmRuleId}/debug` | Get latest debug event | `EventService.findLatestEvents()` |
| `POST` | `/api/alarm/rule/testScript` | Test TBEL expression | Same logic as CF testScript |

### Save endpoint details

Accepts `AlarmRuleDefinition`. The controller:
1. Converts to `CalculatedField` via `toCalculatedField()` (sets `type = ALARM`)
2. Sets `tenantId` from the current user
3. Checks entity permissions (`Operation.WRITE_CALCULATED_FIELD`)
4. Checks referenced entities in the configuration
5. Calls `TbCalculatedFieldService.save()`
6. Converts result back to `AlarmRuleDefinition`

### List endpoint details

Accepts the same filter parameters as the CF list endpoint (entity type, entity IDs, text search, paging) but:
- Does NOT accept `types` parameter (hardcoded to `{ALARM}`)
- Does NOT accept `name` parameter (from the CF endpoint's multi-value `name` query param)
- Returns `PageData<AlarmRuleDefinitionInfo>` (converted from `PageData<CalculatedFieldInfo>`)
- Entity type filter defaults to all entity types that support ALARM (DEVICE, ASSET, CUSTOMER, DEVICE_PROFILE, ASSET_PROFILE), with the same permission check pattern as the CF controller

### Get by entity endpoint details

Accepts `entityType`, `entityId`, paging parameters. Does NOT accept `type` parameter (hardcoded to `ALARM`). Returns `PageData<AlarmRuleDefinition>`.

## UI Changes

### New service: alarm-rules.service.ts

Located in `ui-ngx/src/app/core/http/alarm-rules.service.ts`.

Follows the same `@Injectable({ providedIn: 'root' })` pattern as `CalculatedFieldsService`. Methods:

- `saveAlarmRule(rule: AlarmRuleDefinition)` -> `POST /api/alarm/rule`
- `getAlarmRuleById(id: string)` -> `GET /api/alarm/rule/{id}`
- `getAlarmRulesByEntityId(entityId: EntityId, pageLink: PageLink)` -> `GET /api/alarm/rule/{entityType}/{entityId}`
- `getAlarmRules(pageLink: PageLink, query)` -> `GET /api/alarm/rules`
- `getAlarmRuleNames(pageLink: PageLink)` -> `GET /api/alarm/rules/names`
- `deleteAlarmRule(id: string)` -> `DELETE /api/alarm/rule/{id}`
- `getLatestAlarmRuleDebugEvent(id: string)` -> `GET /api/alarm/rule/{id}/debug`
- `testScript(inputParams)` -> `POST /api/alarm/rule/testScript`

### Consumer updates

All components that currently call `CalculatedFieldsService` for ALARM-type operations switch to `AlarmRulesService`. Primary consumers:

- `AlarmRuleDialogComponent` — switches `saveCalculatedField()` to `saveAlarmRule()`
- Any component loading alarm rules by entity — switches to `getAlarmRulesByEntityId()`
- Components listing alarm rules — switches to `getAlarmRules()`

The TypeScript model type `CalculatedFieldAlarmRule` can be updated or aliased to match the new `AlarmRuleDefinition` shape (without the `type` discriminator field in the request).

## Test Changes

### AlarmRulesTest.java

Located at `application/src/test/java/org/thingsboard/server/cf/AlarmRulesTest.java`.

Updates:
- `saveCalculatedField()` helper changes from `POST /api/calculatedField` to `POST /api/alarm/rule`
- The helper builds `AlarmRuleDefinition` instead of `CalculatedField` (no `type` field, alarm configuration directly on the object)
- GET calls for alarm rules by entity change to `/api/alarm/rule/{entityType}/{entityId}`
- Debug event retrieval may optionally use `/api/alarm/rule/{id}/debug` instead of direct `EventDao` access (though the test currently uses `EventDao` directly for most checks, which is fine)
- The `createAlarmCf()` helper is renamed to `createAlarmRule()` and returns `AlarmRuleDefinition`

## Scope boundaries

**In scope:**
- New `AlarmRuleDefinition` and `AlarmRuleDefinitionInfo` DTOs
- New `AlarmRuleController` with all listed endpoints
- New `AlarmRulesService` on the UI side
- Update `AlarmRulesTest` to use new API
- Update UI components to use new service

**Out of scope:**
- Changes to `CalculatedFieldController` (left as-is)
- New permission types (reuses `READ_CALCULATED_FIELD` / `WRITE_CALCULATED_FIELD`)
- Reprocessing endpoints (not applicable to alarm rules)
- New `TbAlarmRuleService` layer (thin wrapper approach, no new service)
