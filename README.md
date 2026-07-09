# US-GFECD Architecture

**US-GFECD** — это архитектурный подход для построения масштабируемых realtime-приложений с чётким разделением ответственности на клиенте и сервере.

---

## 📖 Обзор

Аббревиатура расшифровывается как:

**Клиентская часть:**
- **U** — UI (интерфейс)
- **S** — Store (состояние + логика)

**Серверная часть:**
- **G** — Gate (входной адаптер сервера)
- **F** — Flow (оркестрация сценариев)
- **E** — Emit (исходящие события)
- **C** — Core (чистая бизнес-логика)
- **D** — Db (доступ к данным)

### Ключевые принципы

- **Бизнес-логика только на сервере** — клиент максимально тонкий
- **Строгие зависимости между слоями** — только сверху вниз
- **Микросервисная готовность** — через API Gateway
- **Декларативный клиент** — минимум кода, максимум описания

---

# 📱 Клиент (US — UI + Store)

Клиентская часть состоит из двух компонентов: **UI** (интерфейс) и **Store** (состояние + логика).

## Структура клиента

```
src/
├── store/
│   ├── state/          # Данные и редьюсеры (без логики инициализации)
│   ├── entity/         # Объединение данных, инициализации и подписки
│   └── method/         # Действия (createMethod)
├── ui/
│   ├── view/           # Компоненты-читатели
│   ├── edit/           # Компоненты-писатели
│   ├── widget/         # Группы view/edit
│   └── page/           # Страницы
└── index.js
```

**Что изменилось:**
- Раньше `state/` и `init/` были отдельными папками, а в store регистрировались два слайса.
- Теперь `state/` содержит только `initialState` и `reducers` (чистые данные).
- `entity/` объединяет данные, логику инициализации (`createEntity`) и подписку — в store регистрируется **один** слайс.
- Папка `event/` и функция `createSub` **больше не нужны** — подписка описывается прямо в `createEntity` через параметр `handlers`.
- `method/` использует экшены из `entity.actions`.

## Быстрый старт

### 1. Установка

```bash
npm install @us-gfecd/client socket.io-client react-redux @reduxjs/toolkit
```

### 2. Инициализация структуры

```bash
npx us-gfecd init
```

### 3. Создайте State (данные и редьюсеры)

```js
// src/store/state/contestStatusState.js
export const initialState = {
  status: null,
  start_date: null,
  end_date: null,
}

export const reducers = {
  setContestStatus: (state, action) => {
    const { status, start_date, end_date } = action.payload
    state.status = status
    state.start_date = start_date
    state.end_date = end_date
  },
  clearContestStatus: (state) => {
    state.status = null
    state.start_date = null
    state.end_date = null
  },
}
```

### 4. Создайте Entity (инициализация, состояние и подписка)

```js
// src/store/entity/contestStatusEntity.js
import { createEntity } from '@us-gfecd/client'
import { initialState, reducers } from '../state/contestStatusState'
import { socket } from '../index'

export const contestStatus = createEntity({
  name: 'contestStatus',
  initialState,
  reducers,
  call: 'contest:getCurrentStatus',
  save: 'setContestStatus',      // имя экшена из reducers
  handlers: {                    // подписка на события
    contestStatusUpdated: 'setContestStatus',
    contestStatusDeleted: 'clearContestStatus',
  },
  socket,
})
```

### 5. Создайте Method (действия)

```js
// src/store/method/userMethod.js
import { createMethod } from '@us-gfecd/client'
import { userEntity } from '../entity/userEntity'

const { addUser } = userEntity.actions  // экшены из entity

export const createUser = createMethod({
  call: 'createUser',
  save: addUser,   // экшен-криэйтор
})
```

### 6. Подключите в store (один слайс!)

```js
// src/store/configureStore.js
import { configureStore } from '@reduxjs/toolkit'
import { contestStatus } from './entity/contestStatusEntity'

export const store = configureStore({
  reducer: {
    contestStatus: contestStatus.slice.reducer,
  },
})
```

### 7. Используйте в компоненте

```jsx
// src/ui/view/ContestStatusView.jsx
import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { contestStatus } from '../../store/entity/contestStatusEntity'

const { init, clean, selectors } = contestStatus

export const ContestStatusView = () => {
  const dispatch = useDispatch()
  const data = useSelector(selectors.selectData)
  const { loading, error } = useSelector(selectors.selectState)

  useEffect(() => {
    dispatch(init())
    return () => dispatch(clean())
  }, [dispatch])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!data) return <div>No data</div>

  return (
    <div>
      <p>Status: {data.status}</p>
      <p>Start: {data.start_date}</p>
      <p>End: {data.end_date}</p>
    </div>
  )
}
```

---

## API клиента

### `createEntity({ name, initialState, reducers, call, save, handlers, socket })`

Создаёт сущность с состоянием, инициализацией и встроенной подпиской.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | `string` | Уникальное имя сущности (ключ в store) |
| `initialState` | `Object` | Начальное состояние данных (без служебных полей) |
| `reducers` | `Object` | Объект с редьюсерами для данных (экшены генерируются автоматически) |
| `call` | `string` | Имя события Socket.IO для запроса данных |
| `save` | `string` | Имя экшена из `reducers`, который будет вызван для сохранения данных (например, `'setData'`) |
| `handlers` | `Object` | **Объект подписки.** Ключ — имя события, значение — имя экшена из `reducers` или объект `{ room, save }` для комнат. |
| `socket` | `Socket` | Экземпляр сокета |

**Возвращает:** `{ slice, actions, init, clean, selectors }`

- `slice` — готовый reducer для подключения в store (один!)
- `actions` — все экшены (пользовательские + служебные)
- `init(params)` — thunk для загрузки данных. Параметры передаются в `call` и используются для подстановки в шаблоны комнат.
- `clean()` — thunk для очистки данных и отписки (автоматически покидает комнату)
- `selectors` — мемоизированные селекторы:
  - `selectData` — данные сущности
  - `selectState` — всё состояние (данные + флаги)
  - `selectLoading`, `selectError`, `selectInitialized`

**Форматы `handlers`:**

1. **Глобальное событие** (без комнаты):

```js
handlers: {
  userCreated: 'addUser',   // строка — имя экшена из entity.actions
  usersLoaded: 'setUsers',
}
```

2. **Событие с комнатой (статика):**

```js
handlers: {
  adminUpdated: {
    room: 'admin',
    save: 'updateAdmin',
  },
}
```

3. **Событие с параметризованной комнатой (шаблон):**

```js
handlers: {
  userPageUpdated: {
    room: 'user{id}',
    save: 'setCurrentUser',
  },
  userPageDeleted: {
    room: 'user{id}',
    save: 'clearCurrentUser',
  },
}
```

**Подстановка параметров:**
- `{id}` — заменяется на `params.id` из `init(params)`
- `{userId}` — заменяется на `params.userId`
- Если параметр отсутствует — подставляется пустая строка

**Пример с параметрами (для комнат):**

```js
const userEntity = createEntity({
  name: 'user',
  initialState: { current: null },
  reducers: { setCurrentUser: (state, action) => { state.current = action.payload } },
  call: 'user:getOne',
  save: 'setCurrentUser',
  handlers: {
    userPageUpdated: {
      room: 'user{id}',
      save: 'setCurrentUser',
    },
    userPageDeleted: {
      room: 'user{id}',
      save: 'clearCurrentUser',
    },
  },
  socket,
})

// В компоненте:
dispatch(init({ id: userId }))
// Библиотека автоматически:
// 1. Вызовет socket.emit('user:getOne', { id: userId })
// 2. Подпишется на события и вступит в комнату 'user123'
```

### `createMethod({ call, save })`

Создаёт thunk для отправки запросов.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `call` | `string` | Имя события Socket.IO |
| `save` | `Function` | Экшен-криэйтор (из `entity.actions`) |

**Возвращает:** thunk `(data) => dispatch => { ... }`

**Пример:**

```js
import { userEntity } from '../entity/userEntity'
const { addUser } = userEntity.actions

export const createUser = createMethod({
  call: 'createUser',
  save: addUser,
})
```

---

### `createSocket(config)`

Создаёт экземпляр Socket.IO.

```js
import { createSocket } from '@us-gfecd/client'

const socket = createSocket({
  url: 'https://api.example.com',
  autoConnect: true,
})
```

---

## Комнаты (Rooms) — как это работает

### Проблема

Без комнат все клиенты получают все события. Если 100 клиентов смотрят 100 разных страниц, каждый получает обновления для всех страниц — это нагрузка и лишние обновления store.

### Решение

Используются **комнаты Socket.IO**. Клиент автоматически вступает в комнату при вызове `init({ id })` и покидает её при `clean()`.

### Как это выглядит в коде

**1. Описываем подписку с комнатой в `handlers`:**

```js
// store/entity/userEntity.js
export const userEntity = createEntity({
  name: 'user',
  initialState: { current: null },
  reducers: { setCurrentUser: (state, action) => { state.current = action.payload } },
  call: 'user:getOne',
  save: 'setCurrentUser',
  handlers: {
    userPageUpdated: {
      room: 'user{id}',
      save: 'setCurrentUser',
    },
  },
  socket,
})
```

**2. В компоненте:**

```jsx
const { init, clean } = userEntity

useEffect(() => {
  dispatch(init({ id: userId })) // Вступает в комнату 'user123'
  return () => dispatch(clean())  // Покидает комнату 'user123'
}, [userId])
```

**3. Сервер отправляет событие только в комнату:**

```go
// Go-сервер
Server.To(socket.Room("user123")).Emit("userPageUpdated", userData)
```

### Преимущества

- ✅ Только нужные клиенты получают обновления
- ✅ Меньше трафика и нагрузки
- ✅ Автоматическое управление комнатами
- ✅ Чистый код без ручных `join`/`leave`

---

## Потоки данных на клиенте

### Инициализация с комнатой

1. View монтируется → `useEffect` вызывает `init({ id: userId })`
2. `init` проверяет флаги (`loading`, `initialized`)
3. Если данные не загружены → `socket.emit('user:getOne', { id: userId })`
4. Полученные данные сохраняются через `save`
5. Подписка (из `handlers`) активируется: вызывается `subscribe(dispatch, params)`.
6. Клиент **вступает в комнату** `user123` (если указана комната)
7. View отображает данные

### Realtime обновление (только в комнате)

1. Сервер присылает событие `userPageUpdated` в комнату `user123`
2. Встроенная подписка вызывает экшен `setCurrentUser`
3. Store обновляется → View перерисовывается
4. Другие клиенты (в других комнатах) событие не получают

### Деинициализация

1. View размонтируется → `useEffect` вызывает `clean()`
2. `clean` уменьшает счётчик подписчиков
3. Если это последний компонент → отписка от событий (включая выход из комнаты)
4. Клиент **покидает комнату** `user123`
5. Данные очищаются

---

# 📦 Библиотека

## Установка

```bash
npm install @us-gfecd/client
```

## Peer зависимости

```json
"peerDependencies": {
  "react": ">=18.0.0",
  "react-redux": ">=8.0.0",
  "socket.io-client": ">=4.5.0"
}
```

---

# 🖥️ Сервер (GFECD)

Серверная часть реализована на **Go** с использованием библиотеки **`github.com/zishang520/socket.io`** — это современная реализация Socket.IO v4, обеспечивающая полную совместимость с клиентской библиотекой `socket.io-client` v4 и поддержку комнат, широковещательных рассылок, автоматического переподключения и других фич протокола.

## Структура сервера

```
server/
├── gate/           # Входной адаптер
│   └── userGate.go
├── flow/           # Оркестрация сценариев
│   ├── userFlow.go
│   └── atomic/     # Атомарные сценарии
│       └── checkAccessFlow.go
├── core/           # Бизнес-логика
│   └── userCore.go
├── db/             # Доступ к данным
│   └── userDb.go
└── emit/           # Исходящие события
    └── userEmit.go
```

## Слои сервера

### Gate (входной адаптер)

**Назначение:** принимает запросы, проверяет авторизацию, валидирует входные данные.

**Правила:**
- Обычно Gate вызывает **один Flow** для конкретного запроса.
- **Исключение:** Gate может вызывать **несколько Flow**, если это необходимо для маршрутизации (например, обработчик вебхуков, который направляет запросы к разным Flow в зависимости от типа данных). В таких случаях Gate выступает как диспетчер.
- Для поддержания читаемости в сложных сценариях допускается вызов нескольких Flow из одного Gate.

**Пример (один Gate → один Flow):**

```go
// gate/userGate.go
import "github.com/zishang520/socket.io/socket"

func RegisterUserHandlers(server *socket.Server) {
    server.OnEvent("/", "user:getOne", func(s socket.Conn, params map[string]string, callback func(interface{})) {
        user, err := flow.GetUserByID(params["id"])
        if err != nil {
            callback(map[string]string{"error": err.Error()})
            return
        }
        callback(user)
    })
}
```

**Пример (один Gate → несколько Flow — Webhook):**

```go
// gate/webhookGate.go
func WebhookHandler(w http.ResponseWriter, r *http.Request) {
    // ... парсинг payload
    switch payload.Collection {
    case "contests":
        flow.HandleContests(payload)   // вызов одного Flow
    case "themes":
        flow.HandleThemes(payload)     // вызов другого Flow
    // ...
    }
}
```

**Разрешено:**
- ✅ Вызывать один или несколько Flow
- ✅ Проверять авторизацию
- ✅ Валидировать входные данные
- ✅ Обрабатывать `join`/`leave` для комнат

**Запрещено:**
- ❌ Содержать бизнес-логику
- ❌ Работать с БД напрямую
- ❌ Вызывать Emit

---

### Flow (оркестрация)

**Назначение:** координирует выполнение бизнес-процессов, управляет транзакциями.

**Пример обычного Flow:**

```go
// flow/userFlow.go
func GetUserByID(id string) (*models.User, error) {
    user, err := db.GetUserByID(id)
    if err != nil {
        return nil, err
    }
    return user, nil
}

func CreateUser(data models.UserInput) (*models.User, error) {
    // 1. Валидация
    validated, err := core.ValidateUser(data)
    if err != nil {
        return nil, err
    }

    // 2. Сохранение в БД
    user, err := db.CreateUser(validated)
    if err != nil {
        return nil, err
    }

    // 3. Отправка события в комнату
    room := fmt.Sprintf("user:%s", user.ID)
    emit.UserCreated(user, room)

    return user, nil
}
```

**Атомарный Flow (не вызывает другие Flow):**

```go
// flow/atomic/checkAccessFlow.go
func CheckAccessFlow(userId, action string) error {
    user, err := db.GetUserByID(userId)
    if err != nil {
        return err
    }
    if !user.IsAdmin {
        return errors.New("access denied")
    }
    return nil
}
```

**Разрешено:**
- ✅ Вызывать Core, Db, Emit
- ✅ Вызывать атомарные Flow
- ✅ Управлять транзакциями

**Запрещено:**
- ❌ Содержать бизнес-логику (она в Core)
- ❌ Импортировать Gate

---

### Core (чистая бизнес-логика)

**Назначение:** содержит бизнес-правила, расчёты, алгоритмы. Чистые функции без побочных эффектов.

**Пример:**

```go
// core/userCore.go
func ValidateUser(data UserInput) (UserInput, error) {
    if len(data.Name) < 2 {
        return data, errors.New("name is too short")
    }
    if !strings.Contains(data.Email, "@") {
        return data, errors.New("invalid email")
    }
    return data, nil
}

func CalculateAge(birthDate time.Time) int {
    return time.Now().Year() - birthDate.Year()
}
```

**Разрешено:**
- ✅ Содержать бизнес-логику
- ✅ Импортировать другие Core модули
- ✅ Быть чистыми функциями

**Запрещено:**
- ❌ Импортировать Gate, Flow, Emit, Db
- ❌ Работать с БД
- ❌ Иметь побочные эффекты

---

### Db (доступ к данным)

**Назначение:** инкапсулирует доступ к БД, CRUD-операции.

**Пример:**

```go
// db/userDb.go
func GetUserByID(id string) (*models.User, error) {
    var user models.User
    err := DB.Where("id = ?", id).First(&user).Error
    if errors.Is(err, gorm.ErrRecordNotFound) {
        return nil, nil
    }
    return &user, err
}

func CreateUser(data models.UserInput) (*models.User, error) {
    user := models.User{
        Name:  data.Name,
        Email: data.Email,
    }
    err := DB.Create(&user).Error
    return &user, err
}
```

**Разрешено:**
- ✅ Выполнять запросы чтения/записи
- ✅ Отвечать на вопросы (например, `isUserInRoom`)
- ✅ Инкапсулировать структуру данных

**Запрещено:**
- ❌ Содержать бизнес-логику
- ❌ Оркестрировать запросы (вызывать несколько методов)
- ❌ Раскрывать внутреннюю структуру данных

---

### Emit (исходящие события)

**Назначение:** отправляет события клиентам через WebSocket.

**Пример с комнатами:**

```go
// emit/userEmit.go
import "github.com/zishang520/socket.io/socket"

func UserCreated(user *models.User, room string) {
    if Server == nil {
        log.Println("Socket.IO server not initialized")
        return
    }
    Server.To(socket.Room(room)).Emit("userPageUpdated", user)
    log.Printf("📤 Emitted userPageUpdated to room: %s", room)
}

func UserDeleted(userID string) {
    if Server == nil {
        return
    }
    room := fmt.Sprintf("user:%s", userID)
    Server.To(socket.Room(room)).Emit("userPageDeleted", map[string]interface{}{
        "id":       userID,
        "_deleted": true,
    })
    log.Printf("📤 Emitted userPageDeleted to room: %s", room)
}
```

**Разрешено:**
- ✅ Отправлять события в конкретные комнаты
- ✅ Форматировать сообщения (JSON)
- ✅ Обрабатывать acknowledgment

**Запрещено:**
- ❌ Содержать бизнес-логику
- ❌ Импортировать Gate, Flow, Core, Db

---

## Потоки данных на сервере

### Запрос от клиента с комнатой
1. Клиент вызывает `init({ id: userId })` через Socket.IO
2. Gate принимает запрос `user:getOne` с параметрами
3. Gate вызывает Flow → Core (валидация) → Db (чтение)
4. Ответ возвращается через callback
5. Клиент **вступает в комнату** `user123`

### Обновление данных через Webhook
1. Администратор изменяет данные через Directus
2. Webhook отправляет POST-запрос на сервер
3. Gate (обработчик вебхука) определяет тип коллекции и вызывает соответствующий Flow
4. Flow обрабатывает вебхук: загружает свежие данные из Db и вызывает Emit
5. Emit отправляет событие в соответствующую комнату
6. Только клиенты в этой комнате получают обновление

### Realtime событие от сервера
1. Flow вызывает Emit
2. Emit отправляет событие в указанную комнату
3. Клиенты в комнате получают событие и обновляют store

---

## Золотые правила сервера

1. **Gate** → обычно один Flow, но может вызывать несколько для маршрутизации (например, вебхуки)
2. **Flow** → Core + Db + Emit (может вызывать атомарные Flow)
3. **Core** — только чистая логика
4. **Db** — только данные
5. **Emit** — только отправка, поддерживает комнаты
6. **Комнаты** — используются для точечных обновлений
7. **Никаких обходов слоёв** — Gate не вызывает Core напрямую, Flow не импортирует Gate и т.д.

# 📦 Библиотека

## Peer зависимости

```json
"peerDependencies": {
  "react": ">=18.0.0",
  "react-redux": ">=8.0.0",
  "socket.io-client": ">=4.5.0"
}
```

---

# 🎯 Золотые правила

## Клиент
1. **View** — только читает, вызывает `init` и `clean` через `useEffect`
2. **Edit** — только пишет, вызывает `method`
3. **Event** — вызывает только `update`-редьюсеры
4. **Комнаты** — автоматические, указываются через `{ room: 'entity{id}' }`
5. Никакой бизнес-логики на клиенте

## Сервер
1. **Gate** → обычно один Flow, но может вызывать несколько для маршрутизации (например, вебхуки)
2. **Flow** → Core + Db + Emit (может вызывать атомарные Flow)
3. **Core** — только чистая логика
4. **Db** — только данные
5. **Emit** — только отправка, поддерживает комнаты
6. **Комнаты** — используются для точечных обновлений

---

# 📚 Ссылки

- **Библиотека:** [@us-gfecd/client](https://npmjs.com/package/@us-gfecd/client)