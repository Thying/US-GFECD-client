**🇺🇸 English** | [🇷🇺 Русский](./README.ru.md)

Client library for React + Redux + Socket.IO.

**Separates UI and Store:**

**UI:**
- **View** — connects to Entity, displays data and flags (`loading`, `error`, `data`). Calls `init()` on mount, `clean()` on unmount.
- **Edit** — calls Invoke, passes data. Doesn't care about subscription state.

**Store:**
- **Entity** — extends Redux slice. Adds automatic data management:
  - Loads data when the first View connects.
  - Subscribes to events (handlers).
  - Updates data via events.
  - Cleans up and unsubscribes when the last View disconnects.
  - Supports normalized storage by ID.
- **Invoke** — sends requests to the server and saves results via actions.

Built on the [US-GFECD](https://npmjs.com/package/@us-gfecd/architecture) architecture.

---

## Installation

```bash
npm install @us-gfecd/client
```

**Peer dependencies:**
```json
"peerDependencies": {
  "react": ">=18.0.0",
  "react-redux": ">=8.0.0",
  "socket.io-client": ">=4.5.0"
}
```

---

## Socket

### `createSocket(config)`

Creates a Socket.IO instance.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | Server URL (required). |
| `path` | `string` | Socket.IO path (default `/socket.io/`). |
| `autoConnect` | `boolean` | Auto-connect (default `true`). |
| `transports` | `string[]` | Transports (default `['websocket']`). |
| `auth` | `Object` | Authentication data. |
| `withCredentials` | `boolean` | Send credentials (default `false`). |

**Environment variables:**

The library automatically reads environment variables if set:

| Variable | Description |
|----------|-------------|
| `SOCKET_URL` | Server URL (overridden by `url` parameter). |
| `SOCKET_PATH` | Socket.IO path (overridden by `path` parameter). |
| `SOCKET_TOKEN` | Authentication token (added to `auth`). |

**Priority:** parameters passed to `createSocket` take precedence over environment variables.

**Example:**

```js
import { createSocket } from '@us-gfecd/client';

const socket = createSocket({
  url: 'http://localhost:8080',
  auth: { token: 'your-jwt-token' },
});

// If SOCKET_URL is set in .env, can call without parameters:
// const socket = createSocket();
```

---

## Entity

### What is Entity?

Entity is an **extension of Redux slice**. It combines:

- **Data** — what is stored in the store.
- **Initialization** — loading data on first connection.
- **Subscriptions** — automatic updates via events (handlers).
- **Cleanup** — unsubscribing and removing data when no longer needed.
- **Normalization by ID** — storing multiple entity instances in one slice.

**Entity doesn't know who uses it.** It just lives in the store, receives data, updates via events, and is removed when no one is subscribed.

---

### `createEntity(config)`

Creates an entity (extended slice) with automatic data management.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique entity name (key in store). |
| `initialState` | `Object` | Initial data state (without service fields). |
| `reducers` | `Object` | Data reducers (actions are generated automatically). |
| `call` | `string` | Socket.IO event name for data request. |
| `save` | `string` | Action name from `reducers` for saving data. |
| `handlers` | `Object` | Event subscriptions (see below). |
| `socket` | `Socket` | Socket instance. |
| `onSend`, `onSave`, `onDone`, `onError`, `onClean`, `onEnd` | `Function` | Global lifecycle hooks. |

**Returns:** a function `entity(idParams)` that returns an object with:

- `init()` — thunk for loading data.
- `clean()` — thunk for cleaning data.
- `selectors` — memoized selectors:
  - `selectData` — data only (without flags).
  - `selectState` — full state (data + flags).
  - `selectLoading`, `selectError`, `selectInitialized`.

---

### Subscriptions (handlers)

The `handlers` object describes which events to listen to and which actions to call.

**Formats:**

1. **Global event** (without room):
   ```js
   handlers: {
     userCreated: 'addUser',
     userDeleted: 'removeUser',
   }
   ```

2. **Event with room** (required ID):
   ```js
   handlers: {
     userPageUpdated: {
       room: 'user{id}',
       save: 'setUser',
     },
   }
   ```

3. **Event with optional room**:
   ```js
   handlers: {
     userPageUpdated: {
       room: 'user{?id}',
       save: 'setUser',
     },
   }
   ```

4. **Multiple parameters in room**:
   ```js
   handlers: {
     themeUpdated: {
       room: 'contest{contestId}/theme{themeId}',
       save: 'setTheme',
     },
   }
   ```

---

### Working with ID

Entity supports normalized storage: data for different IDs is stored in one slice.

**Global entity (without ID):**
```js
const status = contestStatus(); // no parameters
status.init();
```

**Entity with ID:**
```js
const user = userEntity({ id: 123 });
user.init();
```

**Multiple ID binding:**
```js
const theme = themeEntity({ contestId: 1, themeId: 5 });
theme.init(); // subscribes to room contest1/theme5
```

**Required parameters:** if `{id}` is specified in the room and ID is not passed — error `CFG-08`.

**Optional parameters:** if `{?id}` is specified in the room and ID is not passed — subscription to the room is not created.

---

### Lifecycle Hooks (global)

Hooks allow you to embed logic into key moments of Entity's operation.

| Hook | When triggered | Receives |
|------|----------------|----------|
| `onSend` | Before sending request | `params` (ID object), `helpers` |
| `onSave` | After receiving response, before saving | `response` (server data), `helpers` |
| `onDone` | After successful save | `savedData` (saved data), `helpers` |
| `onError` | On error | `error` (error object), `helpers` |
| `onClean` | Before cleanup (last subscriber) | `helpers` |
| `onEnd` | After cleanup (last subscriber) | `helpers` |

**Example:**
```js
const contestStatus = createEntity({
  name: 'contestStatus',
  initialState,
  reducers,
  call: 'contest:getCurrentStatus',
  save: 'setContestStatus',
  handlers: {
    contestStatusUpdated: 'setContestStatus',
    contestStatusDeleted: 'clearContestStatus',
  },
  socket,
  onSend: (params) => {
    console.log('Requesting status', params);
    return params;
  },
  onSave: (response) => {
    console.log('Response received', response);
    return response;
  },
  onError: (error) => {
    console.error('Loading error', error);
  },
});
```

---

### State Flags

Entity automatically manages three flags:

- `loading` — loading in progress.
- `initialized` — data loaded and ready.
- `error` — loading error.

They are available via selectors:
```js
const { loading, error } = useSelector(selectors.selectState);
// or
const loading = useSelector(selectors.selectLoading);
const error = useSelector(selectors.selectError);
```

---

### Entity Lifecycle

1. **View mounts** → calls `init()`.
2. **Entity checks** flags (`initialized`, `loading`).
3. **If no data** — sends request (`call`).
4. **After receiving response** — saves data (via `save`) and activates subscription (handlers).
5. **On event** — updates data via action.
6. **View unmounts** → calls `clean()`.
7. **Entity decreases** subscriber counter.
8. **If counter becomes 0** — unsubscribes from events and cleans data.

---

### Example: global entity

**state/contestStatusState.js:**
```js
export const initialState = {
  status: null,
  start_date: null,
  end_date: null,
};

export const reducers = {
  setContestStatus: (state, action) => {
    const { status, start_date, end_date } = action.payload;
    state.status = status;
    state.start_date = start_date;
    state.end_date = end_date;
  },
  clearContestStatus: (state) => {
    state.status = null;
    state.start_date = null;
    state.end_date = null;
  },
};
```

**entity/contestStatusEntity.js:**
```js
import { createEntity } from '@us-gfecd/client';
import { initialState, reducers } from '../state/contestStatusState';
import { socket } from '../index';

export const contestStatus = createEntity({
  name: 'contestStatus',
  initialState,
  reducers,
  call: 'contest:getCurrentStatus',
  save: 'setContestStatus',
  handlers: {
    contestStatusUpdated: 'setContestStatus',
    contestStatusDeleted: 'clearContestStatus',
  },
  socket,
});
```

**view/ContestStatusView.jsx:**
```js
const status = contestStatus(); // global entity
const { init, clean, selectors } = status;

useEffect(() => {
  init();
  return () => clean();
}, []);

const data = useSelector(selectors.selectData);
const loading = useSelector(selectors.selectLoading);
```

---

### Example: entity with ID and room

**state/userState.js:**
```js
export const initialState = { data: null };

export const reducers = {
  setUser: (state, action) => {
    state.data = action.payload;
  },
  clearUser: (state) => {
    state.data = null;
  },
};
```

**entity/userEntity.js:**
```js
import { createEntity } from '@us-gfecd/client';
import { initialState, reducers } from '../state/userState';
import { socket } from '../index';

export const userEntity = createEntity({
  name: 'user',
  initialState,
  reducers,
  call: 'user:getOne',
  save: 'setUser',
  handlers: {
    userPageUpdated: {
      room: 'user{id}',
      save: 'setUser',
    },
    userPageDeleted: {
      room: 'user{id}',
      save: 'clearUser',
    },
  },
  socket,
});
```

**view/UserPage.jsx:**
```js
const user = userEntity({ id: userId });
const { init, clean, selectors } = user;

useEffect(() => {
  init(); // subscribes to room user:{userId}
  return () => clean();
}, [userId]);

const data = useSelector(selectors.selectData);
```

---

## Invoke

### What is Invoke?

Invoke is an active call. It sends a request to the server and saves the response. Used in **Edit** components for data modification.

**Difference from Entity:**
- Entity — passive. Manages data and subscriptions.
- Invoke — active. Executes request on user command.

---

### `createInvoke(config)`

Creates a function for sending requests.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `call` | `string` | Socket.IO event name. |
| `save` | `Function` | Action creator for saving the result. |
| `socket` | `Socket` | Socket instance. |
| `onSend`, `onSave`, `onDone`, `onError` | `Function` | Global hooks. |

**Returns:** a function `invoke(data, on, id)`.

---

### Signature: `invoke(data, on, id)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `any` | Data to send (optional). |
| `on` | `Object` | Local hooks (optional). |
| `id` | `Object` | Identifiers for normalization (optional). |

**Local hooks (`on`):**

| Hook | When triggered | Receives |
|------|----------------|----------|
| `onSend` | Before sending | `(data, base, helpers)` |
| `onSave` | Before saving | `(response, base, helpers)` |
| `onDone` | After successful save | `(savedData, base, helpers)` |
| `onError` | On error | `(error, base, helpers)` |

**`base` mechanism:**
- If local hook is defined, it can call `base()` to execute the global hook.
- If local hook doesn't call `base()`, global hook is not executed (full override).
- If local hook calls `base()` and there is no global hook — error `HOK-01`.

---

### Global and Local Hooks

**Global hooks** are set in `createInvoke` and apply to all calls:
```js
const updateUser = createInvoke({
  call: 'updateUser',
  save: setUser,
  socket,
  onSend: (data) => {
    console.log('Global onSend');
    return data;
  },
});
```

**Local hooks** are passed on call and override global ones:
```js
await updateUser(
  { name: 'John' },
  {
    onSend: (data, base) => {
      console.log('Local onSend');
      return base(data); // call global
    },
  },
  { id: userId }
);
```

---

### Working with ID in Invoke

ID is passed as the third argument and is used to save data in the correct slot in the normalized storage.

```js
const ids = { id: 123, roomid: 456 };
await updateUser(
  { name: 'Jane' },
  null, // no local hooks
  ids   // same ID as in Entity
);
```

---

### Example: complete scenario with Invoke

**state/userState.js:**
```js
export const initialState = { data: null };

export const reducers = {
  setUser: (state, action) => { state.data = action.payload; },
};
```

**entity/userEntity.js:**
```js
export const userEntity = createEntity({
  name: 'user',
  initialState,
  reducers,
  call: 'user:getOne',
  save: 'setUser',
  handlers: {
    userPageUpdated: {
      room: 'user{id}',
      save: 'setUser',
    },
  },
  socket,
});
```

**method/updateUser.js:**
```js
import { createInvoke } from '@us-gfecd/client';
import { reducers } from '../state/userState';

const { setUser } = reducers;

export const updateUser = createInvoke({
  call: 'updateUser',
  save: setUser,
  socket,
  onSend: (data) => {
    console.log('Updating user', data);
    return data;
  },
  onDone: (saved) => {
    console.log('User updated', saved);
  },
});
```

**edit/EditUserForm.jsx:**
```js
const handleSubmit = async (data) => {
  await updateUser(
    data,
    {
      onDone: (saved, base) => {
        base(saved); // call global onDone
        closeModal();
        showNotification('User updated');
      },
      onError: (error) => {
        console.error('Update error', error);
      },
    },
    { id: userId } // ID for normalization
  );
};
```

---

## Errors

All library errors are instances of `UsGfecdError` and contain `code` and `context` fields with information about the occurrence location and available values.

**Error format:**
```js
{
  name: 'UsGfecdError',
  code: 'CFG-01',
  message: '[createEntity: user] save action "setUser" not found in reducers',
  context: {
    factory: 'createEntity',
    entityName: 'user',
    availableActions: ['setUser', 'clearUser'],
  },
}
```

### Error Codes

| Code | Description | Context |
|------|-------------|---------|
| **CFG-01** | `save` action not found in `reducers`. | Entity name, available actions. |
| **CFG-02** | `socket` not provided. | Factory (`createEntity` / `createInvoke`). |
| **CFG-03** | `handlers` is not an object. | Entity name. |
| **CFG-04** | `handlers` missing `save` field. | Entity name, event. |
| **CFG-05** | Required parameter (`name` or `call`) missing. | Factory. |
| **CFG-06** | `handlers` references action not found in `actions`. | Entity name, event, missing action, available actions. |
| **CFG-07** | Socket URL not provided. | Factory `createSocket`. |
| **CFG-08** | Required room parameter missing. | Entity name, parameter. |
| **NET-01** | Connection to server lost. | – |
| **NET-02** | Response timeout. | – |
| **NET-03** | Server returned an error. | Factory, event, server error text. |
| **NET-04** | Socket connection error. | – |
| **DAT-01** | `onSave` returned primitive instead of object. | Factory, event. |
| **DAT-02** | `onSend` returned non-object. | Factory, event. |
| **DAT-03** | Error in `onSave`/`onSend` hook. | Factory, event, original error. |
| **DAT-04** | `onSave` hook threw an exception. | Factory, event. |
| **DAT-05** | Server response is not valid JSON. | – |
| **DAT-06** | Response structure does not match expected. | – |
| **DAT-07** | `onSave` returned `null`, saving skipped (warning). | – |
| **SUB-01** | Attempt to subscribe without active socket. | – |
| **SUB-02** | Error entering room. | – |
| **SUB-03** | Error leaving room. | – |
| **HOK-01** | Local hook called `base` but global hook not defined. | Factory, event, hook. |
| **HOK-02** | `onSend` returned `null`, request cancelled (warning). | – |
| **HOK-03** | `onDone` hook threw an exception. | – |
| **HOK-04** | `onError` hook threw an exception. | – |
| **LIF-01** | `clean` called before `init` (warning). | – |
| **LIF-02** | `init` called again, data already loaded (warning). | – |
| **LIF-03** | `clean` called but subscription already removed (warning). | – |

---

## License

MIT

---

**Links:**
- [US-GFECD Architecture](https://npmjs.com/package/@us-gfecd/architecture)
- [Repository](https://github.com/Thying/US-GFECD-client)