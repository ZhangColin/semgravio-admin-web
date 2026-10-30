# SPEC-24: 应用管理页面

## Problem Statement

运营人员需要在统一后台中管理「应用」——创建应用、维护基本信息、管理 API Key 和 SSO Client 配置。后端已通过 Flyway V10 种子化菜单和 BFF 接口（admin [#25](https://github.com/ZhangColin/semgravio-admin/issues/25)），前端需提供完整的列表-创建-详情闭环。

## Solution

新增「应用管理」模块：分页列表（搜索/筛选/启停）+ 创建对话框 + 详情页（三区块独立保存：基本信息、API Key、SSO Client）。路由与后端种子的 `routeName=app` / `routeName=app_list` 对齐，动态菜单模式下 sidebar 自动出现。

## User Stories

1. As an 运营人员, I want to see a paginated list of all apps with keyword search and status filter, so that I can quickly find and review apps.
2. As an 运营人员, I want to create a new app by filling in appCode, name, and description, so that I can register a new application in the platform.
3. As an 运营人员, I want the system to validate appCode format (4-64 lowercase alphanumeric + hyphens) on creation, so that I don't create apps with invalid codes.
4. As an 运营人员, I want to be redirected to the app detail page immediately after creating an app, so that I can continue configuring its API Key and SSO Client.
5. As an 运营人员, I want to click a row or a "详情" button to enter the app detail page, so that I can view and manage the full app configuration.
6. As an 运营人员, I want to enable or disable an app directly from the list page with a confirmation toggle, so that I can control app access without navigating into details.
7. As an 运营人员, I want to delete an app (with confirmation), so that I can remove apps that are no longer needed.
8. As an 运营人员, I want to batch-delete multiple apps at once, so that I can clean up obsolete apps efficiently.
9. As an 运营人员, I want to see the app's basic info (appCode read-only, name/description editable) on the detail page, so that I can update app metadata.
10. As an 运营人员, I want to toggle the app's status on the detail page, so that I can enable/disable an app while viewing its full configuration.
11. As an 运营人员, I want each section on the detail page (basic info, API Key, SSO Client) to have its own independent save button, so that I can commit changes to one section without affecting others.
12. As an 运营人员, I want to generate an apiSecret for an app by clicking "生成 Secret", so that the app can authenticate with the platform.
13. As an 运营人员, I want the generated apiSecret to be displayed in plaintext exactly once after generation, so that I can copy and store it securely before it's hidden.
14. As an 运营人员, I want to reset (regenerate) an existing apiSecret, so that I can rotate credentials when needed.
15. As an 运营人员, I want to see the apiSecret status as a read-only tag (e.g. "未生成" or active), so that I know whether the app has credentials configured.
16. As an 运营人员, I want to configure SSO Client for an app (redirectUris, scopes, grants), so that the app can use SSO authentication.
17. As an 运营人员, I want to add and remove redirectUris entries in a dynamic list, so that I can specify multiple allowed redirect targets.
18. As an 运营人员, I want to input scopes and grants as tag-based inputs, so that I can manage these lists intuitively.
19. As an 运营人员, I want the clientSecret to be displayed in plaintext exactly once after configuring/resetting SSO, so that I can copy it before it's hidden.
20. As an 运营人员, I want to see a "配置 SSO" button when no SSO is configured, and "更新 SSO" / "重置 SSO" buttons when already configured, so that the UI matches the current state.
21. As an 运营人员, I want to see the SSO Client status as a read-only tag, so that I know whether SSO is configured and active.

## Implementation Decisions

### Route & Menu Alignment

- Backend has seeded menu `routeName=app_list`, `routePath=/app/list`, `component=view.app_list`, `i18nKey=route.app_list`
- Parent directory menu: `routeName=app`, `routePath=/app`, `component=layout.base`, `i18nKey=route.app`
- Detail page URL: `/app/list/:id` — NOT in the sidebar menu (`hideInMenu: true`), highlighted via `activeMenu: 'app_list'`

### No Permission Gating

- 权限码 (`admin:app:read` / `admin:app:write`) 框架尚未最终确定——本 spec 不添加 `hasAuth`/`canWrite` 判断，所有操作按钮直接可用。后续统一接入权限时批量修改。

### API Layer (8 endpoints)

All via admin BFF (`/api/admin/apps`), using the project's flat request pattern (`{ data, error }`):

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/apps?page=&size=&keyword=&status=` | `PageResponse<AppSummary>` |
| GET | `/apps/{id}` | `AppDetail { app, apiKey, ssoClient }` |
| POST | `/apps` | `string` (new app id) |
| PUT | `/apps/{id}` | `null` |
| PUT | `/apps/{id}/disable` | `null` |
| PUT | `/apps/{id}/enable` | `null` |
| POST | `/apps/{id}/api-key` | `{ apiSecret }` — secret returned once |
| POST | `/apps/{id}/sso-client` | `{ clientSecret }` — secret returned once |

### Type Shapes

```typescript
// List item
interface AppSummary {
  id: string; appCode: string; name: string; description: string | null;
  status: number;    // 0=禁用, 1=启用 (integer, same convention as user/role/menu)
  statusName: string; createdAt: string; updatedAt: string;
}

// Detail aggregation
interface AppDetail {
  app: AppSummary;
  apiKey: { apiKey: string; status: number; statusName: string; };
  ssoClient: { clientId: string; redirectUris: string[]; scopes: string[];
               grants: string[]; status: number; statusName: string; } | null;
}
```

- `apiSecret` / `clientSecret` never stored in detail response — only returned transiently by generate/reset endpoints
- `apiKey` = `appCode` (derived, read-only)
- `ssoClient = null` means not yet configured

### Detail Page: Three-Card Layout (New Pattern)

This project has no existing full-page detail pattern — all current CRUD uses drawer/modal editing. The detail page introduces:

- **Route param flow**: `[id].vue` bracket filename → elegant-router auto-sets `props: true` → `id` arrives as component prop
- **Layout**: `NSpace vertical :size="16"` wrapping 3 `NCard` blocks
- **Each card has independent**: data, edit state, save button, loading/error handling
- **Secret display**: after generate/reset API calls, show returned secret in a modal with copy button + dismiss warning ("Secret 仅展示一次，请立即复制保存")

### Pagination Convention

- Request: `page` is **0-based**, `size` for page size
- Response: `page` is **1-based** in `PageResponse`, `total` is Long serialized as string
- `defaultTransform()` handles the conversion (already used by user/role list pages)

### i18n

Keys under `page.manage.app.*` (page content) and `route.app` / `route.app_list` (sidebar). Three-file edit per project invariant: `src/typings/app.d.ts` Schema + `zh-cn.ts` + `en-us.ts`.

## Testing Decisions

### What Makes a Good Test

- Test external behavior: API calls, form validation, data transformation, component rendering with given props
- Do NOT test internal implementation: hook internals, exact CSS classes, Naive UI internal behavior

### Seams (Highest to Lowest)

1. **API functions** (highest seam) — mock the `request()` transport, verify each `fetch*` function sends correct method/url/params/data and returns typed response
2. **Component behavior** — render list page with mock data, verify columns render, search triggers API call, row click navigates, create modal validates and submits, detail page fetches and renders three cards

### Prior Art

- `src/hooks/common/table.ts` — `useNaivePaginatedTable`, `useTableOperate`, `defaultTransform` (already used identically by user/role list pages)
- `src/hooks/common/form.ts` — `useNaiveForm`, `useFormRules` (used by user-operate-drawer)
- `src/views/manage/components/status-switch.vue` — reusable enable/disable toggle (used by all three manage lists)

## Out of Scope

- **权限控制**: `admin:app:read` / `admin:app:write` 权限判断——框架未定，延后统一接入
- **E2E 测试**: 首版先做类型检查 + 手动验证，E2E 不在本 spec
- **应用关联**: app 与其他实体（用户/角色）的关联关系——本 spec 仅做独立 CRUD
- **SSO Client 删除**: 本 spec 仅支持配置/更新/重置，不支持完全移除 SSO 配置

## Further Notes

- 后端 spec: https://github.com/ZhangColin/semgravio-admin/issues/25
- 依赖 app-registry: ZhangColin/semgravio-app-registry#14 / #15
- 创建页面后必须运行 `pnpm gen-route` 生成 elegant-router 路由定义和类型
- 后端 `AppDetailResponse` 中 `apiKey`/`ssoClient` 为 `@JsonInclude(NON_NULL)`——首次创建后 ssoClient 为 null，前端需处理空态
- `appCode` = `apiKey` 是后端保证的一一对应关系，前端作为只读展示即可
