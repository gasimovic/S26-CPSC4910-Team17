# LLM Capsule

SIGMA::S26-CPSC4910-Team17  
TYPE::fullstack-webapp  
STACK::FE[React18+Vite5,SPA-single-file-state-machine] + BE[Node18,Express,workspace-monorepo] + DB[MySQL8] + INFRA[LOCAL:docker-compose mysql:3307->3306 | PROD:AWS EC2(app deploy)+AWS RDS MySQL(db)]

RUNTIME::  
FE(5173) --proxy--> API_ADMIN(4001) | API_DRIVER(4002) | API_SPONSOR(4003)  
AUTH::bcrypt12 + JWT(2h) + cookie(gdip_token,httpOnly,sameSite=lax,role-gated)  
COMMON_MW::helmet + cors(credentials) + json + cookieParser  
HEALTH::all services expose /healthz (service + db ping pattern)
DEPLOYMENT::AWS[compute=EC2, database=RDS MySQL, app hosted on EC2 and connected to managed RDS]

DOMAIN::  
U=users{id,email,password_hash,role∈{admin,driver,sponsor},preferred_language}  
P_driver=driver_profiles{identity/contact/address,sponsor_org}  
P_sponsor=sponsor_profiles{identity/contact/address,company_name}  
P_admin=admin_profiles{identity/contact/address,display_name}  
AD=ads{sponsor_id,title,description,requirements,benefits}  
APP=applications{driver_id,ad_id,sponsor_id,status∈pending|accepted|rejected,reviewed_by,notes}  
CAT=catalog_items{sponsor_id,external_item_id,title,image_url,price,point_cost}  
MSG=messages{sender,recipient|null,broadcast,sponsor_context,body}  
READ=message_reads{message_id,user_id,read_at}  
LEDGER=driver_points_ledger{driver_id,sponsor_id,delta,reason,timestamp}  
RESET=password_reset_tokens{user_id,token_hash,expires_at,used_at}  
SCHED=scheduled_point_awards{sponsor_id,driver_id|null,points,reason,frequency,scheduled_date,recurring,paused,last_run}  
EXP=point_expiration_rules{sponsor_id unique,expiry_days,is_active}  
SPRINT=sprint_info{singleton row id=1}

SERVICE_INTENT::  
ADMIN: auth/me/profile/password + user listing/filter + application oversight + driver points ops + sprint info + language pref  
DRIVER: auth(+forgot/reset password) + me/profile/password + points history/balance + sponsor discovery + applications submit/list + ads feed + messages + sponsor catalog read + sprint info + language pref  
SPONSOR: auth/me/profile/password + ads CRUD + application queue/review + drivers + driver detail + points add/deduct/remove-driver + messaging(direct+broadcast) + sponsor catalog CRUD + fakestore proxy + scheduled awards CRUD/pause + expiration rule + analytics(points) + sprint info + language pref

EXT_API::  
FakeStore client normalizes external product shape -> internal reward item shape  
search=client-side filter over all products  
popular=electronics subset with 10m cache  
sponsor flow: external discovery -> catalog persistence in MySQL -> driver catalog retrieval via sponsor affiliation/accepted app

FRONTEND_MODEL::  
APP=single giant component with explicit page-state router  
URL sync via history API (path-based; legacy query fallback)  
ROLE-AWARE NAV + PAGE GUARDS  
SESSION RESTORE on load via /me (cookie)  
API BASE DYNAMIC: /api/driver default, switchable to /api/sponsor or /api/admin, persisted in localStorage  
FEATURE PAGES::landing,login,account-type,create-account,reset-password,dashboard,profile,account-details,change-password,applications,drivers,catalog,messages,rewards,leaderboard,achievements,sponsor-affiliation,admin-users,about,point-management,log-trip

DATA-FLOW PRIMITIVES::  
register(role)->users+profile  
login(role)->JWT-cookie scoped by api prefix  
me->user+profile hydration  
apply(driver->sponsor/ad)->applications[pending]  
review(sponsor/admin)->applications[accepted|rejected] (+affiliate effects)  
points(sponsor/admin)->ledger delta stream; balance=sum(delta)  
catalog(sponsor)->catalog_items; catalog(driver)->derived sponsor context  
message(sponsor<->driver, broadcast optional)->messages + message_reads  
password reset(driver)->token hash table + one-time consume  
governance(sponsor/admin)->sprint_info, preferred_language, analytics, scheduling/expiration rules

OPERATIONS::  
backend uses npm workspaces (packages/* + services/*)  
run 3 backend services independently  
frontend uses Vite proxy fan-out to the 3 role services  
db migrations include schema bootstrap + points/language evolution + external item id normalization

COMPACT RECALL KEYWORDS::  
role-split-microservices, cookie-jwt-role-guard, mysql-ledger-sum-balance, application-lifecycle, sponsor-catalog-fakestore, messaging-read-tracking, scheduled-awards-expiration, single-file-react-state-router

## Sources used

- [backend/package.json](backend/package.json)
- [docker-compose.yml](docker-compose.yml)
- [frontend/package.json](frontend/package.json)
- [frontend/vite.config.js](frontend/vite.config.js)
- [frontend/src/App.jsx](frontend/src/App.jsx)
- [backend/services/admin/src/index.js](backend/services/admin/src/index.js)
- [backend/services/driver/src/index.js](backend/services/driver/src/index.js)
- [backend/services/sponsor/src/index.js](backend/services/sponsor/src/index.js)
- [backend/packages/server/src/index.js](backend/packages/server/src/index.js)
- [backend/packages/auth/src/index.js](backend/packages/auth/src/index.js)
- [backend/packages/db/src/index.js](backend/packages/db/src/index.js)
- [backend/packages/db/init_gdip_tables.sql](backend/packages/db/init_gdip_tables.sql)
- [backend/packages/db/migrations/001_point_management.sql](backend/packages/db/migrations/001_point_management.sql)
- [backend/routes/sponsor/catalog.js](backend/routes/sponsor/catalog.js)
- [backend/routes/sponsor/fakestore.js](backend/routes/sponsor/fakestore.js)
- [backend/routes/driver/catalog.js](backend/routes/driver/catalog.js)
- [backend/utils/fakestoreClient.js](backend/utils/fakestoreClient.js)
- [REAME.md](REAME.md)
