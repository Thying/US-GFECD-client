# @us-gfecd/client

[🇺🇸 English](./README.md) | **🇷🇺 Русский**

Библиотека для React + Redux + Socket.IO.

**Разделяет UI и Store:**

**UI:**
- **View** — подключается к Entity, показывает данные и флаги (`loading`, `error`, `data`). При монтировании вызывает `init()`, при размонтировании `clean()`.
- **Edit** — вызывает Invoke, передаёт данные. Не заботится о состоянии подписки.

**Store:**
- **Entity** — расширение Redux slice. Добавляет автоматическое управление данными:
  - Загружает данные при первом подключении View.
  - Подписывается на события (handlers).
  - Обновляет данные по событиям.
  - Очищает и отписывается, когда последний View уходит.
  - Поддерживает нормализованное хранилище по ID.
- **Invoke** — отправляет запросы на сервер и сохраняет результат через экшен.

Построена на архитектуре [US-GFECD](https://npmjs.com/package/@us-gfecd/architecture).

---

## Установка

```bash
npm install @us-gfecd/client
```

**Peer-зависимости:**
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

Создаёт экземпляр Socket.IO.

**Параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `url` | `string` | URL сервера (обязательно). |
| `path` | `string` | Путь к Socket.IO (по умолчанию `/socket.io/`). |
| `autoConnect` | `boolean` | Автоподключение (по умолчанию `true`). |
| `transports` | `string[]` | Транспорты (по умолчанию `['websocket']`). |
| `auth` | `Object` | Данные для авторизации. |
| `withCredentials` | `boolean` | Передавать credentials (по умолчанию `false`). |

**Загрузка из переменных окружения:**

Библиотека автоматически читает переменные окружения, если они заданы:

| Переменная | Описание |
|------------|----------|
| `SOCKET_URL` | URL сервера (переопределяется параметром `url`). |
| `SOCKET_PATH` | Путь к Socket.IO (переопределяется параметром `path`). |
| `SOCKET_TOKEN` | Токен авторизации (добавляется в `auth`). |

**Приоритет:** параметры, переданные в `createSocket`, имеют приоритет над переменными окружения.

**Пример:**

```js
import { createSocket } from '@us-gfecd/client';

const socket = createSocket({
  url: 'http://localhost:8080',
  auth: { token: 'your-jwt-token' },
});

// Если в .env задан SOCKET_URL, можно вызвать без параметров:
// const socket = createSocket();
```

---

## Entity

### Что такое Entity?

Entity — это **расширение Redux slice**. Она объединяет:

- **Данные** — то, что хранится в store.
- **Инициализацию** — загрузку данных при первом подключении.
- **Подписки** — автоматическое обновление по событиям (handlers).
- **Очистку** — отписку и удаление данных, когда они больше не нужны.
- **Нормализацию по ID** — хранение нескольких экземпляров сущности в одном slice.

**Entity не знает, кто её использует.** Она просто живёт в store, получает данные, обновляется по событиям и удаляется, когда никто не подписан.

---

### `createEntity(config)`

Создаёт сущность (расширенный slice) с автоматическим управлением данными.

**Параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | `string` | Уникальное имя сущности (ключ в store). |
| `initialState` | `Object` | Начальное состояние данных (без служебных полей). |
| `reducers` | `Object` | Редьюсеры для данных (экшены генерируются автоматически). |
| `call` | `string` | Имя события Socket.IO для запроса данных. |
| `save` | `string` | Имя экшена из `reducers` для сохранения данных. |
| `handlers` | `Object` | Подписка на события (см. ниже). |
| `socket` | `Socket` | Экземпляр сокета. |
| `onSend`, `onSave`, `onDone`, `onError`, `onClean`, `onEnd` | `Function` | Глобальные хуки жизненного цикла. |

**Возвращает:** функцию `entity(idParams)`, которая возвращает объект с полями:

- `init()` — thunk для загрузки данных.
- `clean()` — thunk для очистки данных.
- `selectors` — мемоизированные селекторы:
  - `selectData` — только данные (без флагов).
  - `selectState` — всё состояние (данные + флаги).
  - `selectLoading`, `selectError`, `selectInitialized`.

---

### Подписки (handlers)

Объект `handlers` описывает, какие события слушать и какие экшены вызывать.

**Форматы:**

1. **Глобальное событие** (без комнаты):
   ```js
   handlers: {
     userCreated: 'addUser',
     userDeleted: 'removeUser',
   }
   ```

2. **Событие с комнатой** (обязательный ID):
   ```js
   handlers: {
     userPageUpdated: {
       room: 'user{id}',
       save: 'setUser',
     },
   }
   ```

3. **Событие с опциональной комнатой**:
   ```js
   handlers: {
     userPageUpdated: {
       room: 'user{?id}',
       save: 'setUser',
     },
   }
   ```

4. **Несколько параметров в комнате**:
   ```js
   handlers: {
     themeUpdated: {
       room: 'contest{contestId}/theme{themeId}',
       save: 'setTheme',
     },
   }
   ```

---

### Работа с ID

Entity поддерживает нормализованное хранилище: данные для разных ID хранятся в одном slice.

**Глобальная сущность (без ID):**
```js
const status = contestStatus(); // без параметров
status.init();
```

**Сущность с ID:**
```js
const user = userEntity({ id: 123 });
user.init();
```

**Связка нескольких ID:**
```js
const theme = themeEntity({ contestId: 1, themeId: 5 });
theme.init(); // подпишется на комнату contest1/theme5
```

**Обязательные параметры:** если в комнате указан `{id}`, а ID не передан — будет ошибка `CFG-08`.

**Опциональные параметры:** если в комнате указан `{?id}`, а ID не передан — подписка на комнату не создаётся.

---

### Хуки жизненного цикла (глобальные)

Хуки позволяют встраивать логику в ключевые моменты работы Entity.

| Хук | Когда срабатывает | Что получает |
|-----|-------------------|--------------|
| `onSend` | Перед отправкой запроса | `params` (объект с ID), `helpers` |
| `onSave` | После получения ответа, перед сохранением | `response` (данные от сервера), `helpers` |
| `onDone` | После успешного сохранения | `savedData` (сохранённые данные), `helpers` |
| `onError` | При ошибке | `error` (объект ошибки), `helpers` |
| `onClean` | Перед очисткой (последний подписчик) | `helpers` |
| `onEnd` | После очистки (последний подписчик) | `helpers` |

**Пример:**
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
    console.log('Запрос статуса', params);
    return params;
  },
  onSave: (response) => {
    console.log('Получен ответ', response);
    return response;
  },
  onError: (error) => {
    console.error('Ошибка загрузки', error);
  },
});
```

---

### Флаги состояния

Entity автоматически управляет тремя флагами:

- `loading` — идёт загрузка.
- `initialized` — данные загружены и готовы.
- `error` — ошибка загрузки.

Они доступны через селекторы:
```js
const { loading, error } = useSelector(selectors.selectState);
// или
const loading = useSelector(selectors.selectLoading);
const error = useSelector(selectors.selectError);
```

---

### Жизненный цикл Entity

1. **View монтируется** → вызывает `init()`.
2. **Entity проверяет** флаги (`initialized`, `loading`).
3. **Если данных нет** — отправляет запрос (`call`).
4. **После получения ответа** — сохраняет данные (через `save`) и активирует подписку (handlers).
5. **При получении события** — обновляет данные через экшен.
6. **View размонтируется** → вызывает `clean()`.
7. **Entity уменьшает счётчик подписчиков**.
8. **Если счётчик стал 0** — отписывается от событий и очищает данные.

---

### Пример: глобальная сущность

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
const status = contestStatus(); // глобальная сущность
const { init, clean, selectors } = status;

useEffect(() => {
  init();
  return () => clean();
}, []);

const data = useSelector(selectors.selectData);
const loading = useSelector(selectors.selectLoading);
```

---

### Пример: сущность с ID и комнатой

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
  init(); // подпишется на комнату user:{userId}
  return () => clean();
}, [userId]);

const data = useSelector(selectors.selectData);
```

---

## Invoke

### Что такое Invoke?

Invoke — это активный вызов. Он отправляет запрос на сервер и сохраняет ответ. Используется в **Edit**-компонентах для изменения данных.

**Отличие от Entity:**
- Entity — пассивная. Управляет данными и подписками.
- Invoke — активный. Выполняет запрос по команде пользователя.

---

### `createInvoke(config)`

Создаёт функцию для отправки запросов.

**Параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `call` | `string` | Имя события Socket.IO. |
| `save` | `Function` | Экшен-криэйтор для сохранения результата. |
| `socket` | `Socket` | Экземпляр сокета. |
| `onSend`, `onSave`, `onDone`, `onError` | `Function` | Глобальные хуки. |

**Возвращает:** функцию `invoke(data, on, id)`.

---

### Сигнатура вызова: `invoke(data, on, id)`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | `any` | Данные для отправки (опционально). |
| `on` | `Object` | Локальные хуки (опционально). |
| `id` | `Object` | Идентификаторы для нормализации (опционально). |

**Локальные хуки (`on`):**

| Хук | Когда срабатывает | Что получает |
|-----|-------------------|--------------|
| `onSend` | Перед отправкой | `(data, base, helpers)` |
| `onSave` | Перед сохранением | `(response, base, helpers)` |
| `onDone` | После успешного сохранения | `(savedData, base, helpers)` |
| `onError` | При ошибке | `(error, base, helpers)` |

**Механизм `base`:**
- Если локальный хук определён, он может вызвать `base()`, чтобы выполнить глобальный хук.
- Если локальный хук не вызывает `base()`, глобальный хук не выполняется (полное переопределение).
- Если локальный хук вызывает `base()`, а глобального хука нет — ошибка `HOK-01`.

---

### Глобальные и локальные хуки

**Глобальные хуки** задаются в `createInvoke` и действуют для всех вызовов:
```js
const updateUser = createInvoke({
  call: 'updateUser',
  save: setUser,
  socket,
  onSend: (data) => {
    console.log('Глобальный onSend');
    return data;
  },
});
```

**Локальные хуки** передаются при вызове и переопределяют глобальные:
```js
await updateUser(
  { name: 'John' },
  {
    onSend: (data, base) => {
      console.log('Локальный onSend');
      return base(data); // вызов глобального
    },
  },
  { id: userId }
);
```

---

### Работа с ID в Invoke

ID передаётся третьим аргументом и используется для сохранения данных в правильный слот в нормализованном хранилище.

```js
const ids = { id: 123, roomid: 456 };
await updateUser(
  { name: 'Jane' },
  null, // без локальных хуков
  ids   // те же ID, что и в Entity
);
```

---

### Пример: полный сценарий с Invoke

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
    console.log('Обновление пользователя', data);
    return data;
  },
  onDone: (saved) => {
    console.log('Пользователь обновлён', saved);
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
        base(saved); // вызов глобального onDone
        closeModal();
        showNotification('Пользователь обновлён');
      },
      onError: (error) => {
        console.error('Ошибка обновления', error);
      },
    },
    { id: userId } // ID для нормализации
  );
};
```

---

## Ошибки

Все ошибки библиотеки являются экземплярами `UsGfecdError` и содержат поля `code` и `context` с информацией о месте возникновения и доступных значениях.

**Формат ошибки:**
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

### Коды ошибок

| Код | Описание | Контекст |
|-----|----------|----------|
| **CFG-01** | `save` экшен не найден в `reducers`. | Имя сущности, доступные экшены. |
| **CFG-02** | `socket` не предоставлен. | Фабрика (`createEntity` / `createInvoke`). |
| **CFG-03** | `handlers` не является объектом. | Имя сущности. |
| **CFG-04** | В `handlers` отсутствует поле `save`. | Имя сущности, событие. |
| **CFG-05** | Обязательный параметр (`name` или `call`) отсутствует. | Фабрика. |
| **CFG-06** | `handlers` ссылается на экшен, которого нет в `actions`. | Имя сущности, событие, отсутствующий экшен, доступные экшены. |
| **CFG-07** | URL сокета не указан. | Фабрика `createSocket`. |
| **CFG-08** | Обязательный параметр комнаты отсутствует. | Имя сущности, параметр. |
| **NET-01** | Соединение с сервером потеряно. | – |
| **NET-02** | Таймаут ответа. | – |
| **NET-03** | Сервер вернул ошибку. | Фабрика, событие, текст ошибки сервера. |
| **NET-04** | Ошибка подключения к сокету. | – |
| **DAT-01** | `onSave` вернул примитив вместо объекта. | Фабрика, событие. |
| **DAT-02** | `onSend` вернул не объект. | Фабрика, событие. |
| **DAT-03** | Ошибка в хуке `onSave`/`onSend`. | Фабрика, событие, исходная ошибка. |
| **DAT-04** | Ошибка в хуке `onSave` (выброшено исключение). | Фабрика, событие. |
| **DAT-05** | Ответ сервера не является валидным JSON. | – |
| **DAT-06** | Структура ответа не соответствует ожидаемой. | – |
| **DAT-07** | `onSave` вернул `null`, сохранение пропущено (предупреждение). | – |
| **SUB-01** | Попытка подписаться без активного сокета. | – |
| **SUB-02** | Ошибка при входе в комнату. | – |
| **SUB-03** | Ошибка при выходе из комнаты. | – |
| **HOK-01** | Локальный хук вызвал `base`, но глобальный хук не определён. | Фабрика, событие, хук. |
| **HOK-02** | `onSend` вернул `null`, запрос отменён (предупреждение). | – |
| **HOK-03** | Хук `onDone` выбросил исключение. | – |
| **HOK-04** | Хук `onError` выбросил исключение. | – |
| **LIF-01** | `clean` вызван до `init` (предупреждение). | – |
| **LIF-02** | `init` вызван повторно, данные уже загружены (предупреждение). | – |
| **LIF-03** | `clean` вызван, но подписка уже удалена (предупреждение). | – |

---

## Лицензия

MIT

---

**Ссылки:**
- [Архитектура US-GFECD](https://npmjs.com/package/@us-gfecd/architecture)
- [Репозиторий](https://github.com/Thying/US-GFECD-client)