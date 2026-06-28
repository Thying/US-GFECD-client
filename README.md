Обновлённый README с учётом нового правила: **Gate может вызывать несколько Flow**, когда это оправдано (например, для маршрутизации вебхуков). В остальных случаях рекомендуется один Gate → один Flow для поддержания читаемости.

---

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
│   ├── state/          # Данные + экшены
│   ├── init/           # Инициализация (createInit)
│   ├── event/          # Подписки (createSub)
│   └── method/         # Действия (createMethod)
├── ui/
│   ├── view/           # Компоненты-читатели
│   ├── edit/           # Компоненты-писатели
│   ├── widget/         # Группы view/edit
│   └── page/           # Страницы
└── index.js
```

---

## Быстрый старт

### 1. Установка

```bash
npm install @us-gfecd/client socket.io-client react-redux @reduxjs/toolkit
```

### 2. Инициализация структуры

```bash
npx us-gfecd init
```

### 3. Создайте State (данные)

```js
// src/store/state/userState.js
import { createSlice } from '@reduxjs/toolkit'

const userSlice = createSlice({
  name: 'user',
  initialState: { list: [], loading: false },
  reducers: {
    setUsers: (state, action) => {
      state.list = action.payload
      state.loading = false
    },
    addUser: (state, action) => {
      state.list.push(action.payload)
    },
    setLoading: (state) => {
      state.loading = true
    }
  }
})

export const { setUsers, addUser, setLoading } = userSlice.actions
export default userSlice.reducer
```

### 4. Создайте Event (подписки) с комнатами

```js
// src/store/event/userEvent.js
import { createSub } from '@us-gfecd/client'
import { addUser, setUsers } from '../state/userState'

export const userSub = createSub({
  // Глобальные события (без комнат)
  userCreated: addUser,
  usersLoaded: setUsers,

  // События с комнатами (точечные обновления)
  userPageUpdated: {
    room: 'user{id}',      // Шаблон: 'user123'
    save: setCurrentUser
  },
  userPageDeleted: {
    room: 'user{id}',
    save: (state) => ({ ...state, currentUser: null })
  }
})
```

### 5. Создайте Init (инициализация) с параметрами

```js
// src/store/init/userInit.js
import { createInit } from '@us-gfecd/client'
import { setCurrentUser } from '../state/userState'
import { userSub } from '../event/userEvent'

export const { init, clean, selectors } = createInit({
  call: 'user:getOne',
  save: setCurrentUser,
  sub: userSub
})
```

### 6. Создайте Method (действия)

```js
// src/store/method/userMethod.js
import { createMethod } from '@us-gfecd/client'
import { addUser } from '../state/userState'

export const createUser = createMethod({
  call: 'createUser',
  save: addUser
})
```

### 7. Используйте в компоненте

```jsx
// src/ui/view/UserPage.jsx
import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { init, clean, selectors } from '../../store/init/userInit'

export const UserPage = ({ userId }) => {
  const dispatch = useDispatch()
  const user = useSelector(state => state.user.current)
  const { loading, error } = useSelector(selectors.selectState)

  useEffect(() => {
    // Передаём параметры в init — они используются для комнат
    dispatch(init({ id: userId }))
    return () => dispatch(clean())
  }, [userId, dispatch])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!user) return <div>User not found</div>

  return (
    <div>
      <h1>{user.name}</h1>
      <p>Email: {user.email}</p>
    </div>
  )
}
```

---

## API клиента

### `createInit({ call, save, sub })`

Создаёт thunk для инициализации данных с поддержкой комнат.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `call` | `string` | Имя события Socket.IO для запроса данных |
| `save` | `Function` | Экшен для сохранения данных |
| `sub` | `Object` | Подписка (результат `createSub`) |

**Возвращает:** `{ init, clean, selectors }`

- `init(params)` — thunk для загрузки данных. Параметры передаются в `call` и используются для подстановки в шаблоны комнат.
- `clean()` — thunk для очистки данных и отписки (автоматически покидает комнату)
- `selectors` — селекторы для чтения состояния (`selectState`, `selectLoading`, `selectError`, `selectInitialized`)

**Пример с параметрами:**
```js
// В компоненте
dispatch(init({ id: userId }))
// Библиотека автоматически:
// 1. Вызовет socket.emit('user:getOne', { id: userId })
// 2. Подпишется на события и вступит в комнату 'user123'
```

---

### `createSub(handlers)`

Создаёт подписку на события сервера с поддержкой комнат.

**Форматы обработчиков:**

1. **Глобальное событие** (без комнаты):
```js
createSub({
  userCreated: addUser,
  usersLoaded: setUsers
})
```

2. **Событие с комнатой (статика):**
```js
createSub({
  adminUpdated: {
    room: 'admin',        // Всегда комната 'admin'
    save: updateAdmin
  }
})
```

3. **Событие с параметризованной комнатой (шаблон):**
```js
createSub({
  userPageUpdated: {
    room: 'user{id}',     // 'user123' при init({ id: 123 })
    save: updateUserPage
  },
  userPageDeleted: {
    room: 'user{id}',
    save: clearUserPage
  },
  // Несколько параметров
  teamUpdated: {
    room: 'team{teamId}/user{userId}', // 'team1/user42'
    save: updateTeamUser
  }
})
```

**Подстановка параметров:**
- `{id}` — заменяется на `params.id` из `init(params)`
- `{userId}` — заменяется на `params.userId`
- Если параметр отсутствует — подставляется пустая строка

**Возвращает:** объект с методом `subscribe(dispatch, params)`, который возвращает `unsubscribe`

---

### `createMethod({ call, save })`

Создаёт thunk для отправки запросов.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `call` | `string` | Имя события Socket.IO |
| `save` | `Function` | Экшен для сохранения результата |

**Возвращает:** thunk `(data) => dispatch => { ... }`

---

### `createSocket(config)`

Создаёт экземпляр Socket.IO.

```js
import { createSocket } from '@us-gfecd/client'

const socket = createSocket({
  url: 'https://api.example.com',
  autoConnect: true
})
```

---

## Комнаты (Rooms) — как это работает

### Проблема
Без комнат все клиенты получают все события. Если 100 клиентов смотрят 100 разных страниц, каждый получает обновления для всех страниц — это нагрузка и лишние обновления store.

### Решение
Используются **комнаты Socket.IO**. Клиент автоматически вступает в комнату при вызове `init({ id })` и покидает её при `clean()`.

### Как это выглядит в коде

**1. Описываем подписку с комнатой:**
```js
// store/event/userEvent.js
export const userSub = createSub({
  userPageUpdated: {
    room: 'user{id}',
    save: updateUserPage
  }
})
```

**2. Инициализируем с параметром:**
```js
// store/init/userInit.js
export const { init, clean } = createInit({
  call: 'user:getOne',
  save: setUser,
  sub: userSub
})
```

**3. В компоненте:**
```jsx
useEffect(() => {
  dispatch(init({ id: userId })) // Вступает в комнату 'user123'
  return () => dispatch(clean())  // Покидает комнату 'user123'
}, [userId])
```

**4. Сервер отправляет событие только в комнату:**
```go
// Go-сервер
Server.BroadcastToRoom("/", "user123", "userPageUpdated", userData)
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
5. Активируется подписка `sub.subscribe(dispatch, { id: userId })`
6. Клиент **вступает в комнату** `user123`
7. View отображает данные

### Realtime обновление (только в комнате)
1. Сервер присылает событие `userPageUpdated` в комнату `user123`
2. `createSub` вызывает экшен `updateUserPage`
3. Store обновляется → View перерисовывается
4. Другие клиенты (в других комнатах) событие не получают

### Деинициализация
1. View размонтируется → `useEffect` вызывает `clean()`
2. `clean` уменьшает счётчик подписчиков
3. Если это последний компонент → отписка от событий
4. Клиент **покидает комнату** `user123`
5. Данные очищаются

---

# 🖥️ Сервер (GFECD)

Серверная часть построена на микросервисной архитектуре с чёткими слоями.

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
func RegisterUserHandlers(server *socketio.Server) {
    server.OnEvent("/", "user:getOne", func(s socketio.Conn, params map[string]string, callback func(interface{})) {
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
func UserCreated(user *models.User, room string) {
    if Server == nil {
        log.Println("Socket.IO server not initialized")
        return
    }
    data, _ := json.Marshal(user)
    Server.BroadcastToRoom("/", room, "userPageUpdated", string(data))
    log.Printf("📤 Emitted userPageUpdated to room: %s", room)
}

func UserDeleted(userID string) {
    if Server == nil {
        log.Println("Socket.IO server not initialized")
        return
    }
    room := fmt.Sprintf("user:%s", userID)
    Server.BroadcastToRoom("/", room, "userPageDeleted", "{}")
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

# 🚀 Полный пример (с комнатами)

## Клиент

```js
// src/store/state/contestState.js
import { createSlice } from '@reduxjs/toolkit'

const contestSlice = createSlice({
  name: 'contest',
  initialState: { currentPage: null, list: [] },
  reducers: {
    setContestPage: (state, action) => {
      state.currentPage = action.payload
    },
    updateContestPage: (state, action) => {
      state.currentPage = action.payload
    },
    clearContestPage: (state) => {
      state.currentPage = null
    },
    updateContestInGallery: (state, action) => {
      const idx = state.list.findIndex(c => c.id === action.payload.id)
      if (idx !== -1) state.list[idx] = action.payload
      else state.list.push(action.payload)
    }
  }
})

export const {
  setContestPage,
  updateContestPage,
  clearContestPage,
  updateContestInGallery
} = contestSlice.actions
```

```js
// src/store/event/contestEvent.js
import { createSub } from '@us-gfecd/client'
import {
  updateContestPage,
  clearContestPage,
  updateContestInGallery
} from '../state/contestState'

export const contestSub = createSub({
  // Глобальные события
  contestInGalleryUpdated: updateContestInGallery,

  // События с комнатами
  contestPageUpdated: {
    room: 'contest{id}',
    save: updateContestPage
  },
  contestPageDeleted: {
    room: 'contest{id}',
    save: clearContestPage
  }
})
```

```js
// src/store/init/contestInit.js
import { createInit } from '@us-gfecd/client'
import { setContestPage } from '../state/contestState'
import { contestSub } from '../event/contestEvent'

export const { init, clean, selectors } = createInit({
  call: 'contest:getOne',
  save: setContestPage,
  sub: contestSub
})
```

```jsx
// src/ui/view/ContestPage.jsx
import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { init, clean, selectors } from '../../store/init/contestInit'

export const ContestPage = ({ contestId }) => {
  const dispatch = useDispatch()
  const contest = useSelector(state => state.contest.currentPage)
  const { loading, error } = useSelector(selectors.selectState)

  useEffect(() => {
    dispatch(init({ id: contestId })) // Вступает в комнату 'contest123'
    return () => dispatch(clean())    // Покидает комнату
  }, [contestId, dispatch])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!contest) return <div>Contest not found</div>

  return (
    <div>
      <h1>{contest.title}</h1>
      <p>Status: {contest.status}</p>
      <p>Start: {contest.start_date}</p>
      <p>End: {contest.end_date}</p>
    </div>
  )
}
```

## Сервер (Go)

```go
// gate/contestGate.go
func RegisterContestHandlers(server *socketio.Server) {
    // Обработчик вступления в комнату
    server.OnEvent("/", "join", func(s socketio.Conn, room string) {
        s.Join(room)
        log.Printf("🔗 Client joined room: %s", room)
    })

    server.OnEvent("/", "leave", func(s socketio.Conn, room string) {
        s.Leave(room)
        log.Printf("🔗 Client left room: %s", room)
    })

    // Запрос конкурса
    server.OnEvent("/", "contest:getOne", func(s socketio.Conn, params map[string]string, callback func(interface{})) {
        contest, err := flow.GetContestByID(params["id"])
        if err != nil {
            callback(map[string]string{"error": err.Error()})
            return
        }
        callback(contest)
    })
}
```

```go
// flow/contestFlow.go
func GetContestByID(id string) (*models.Contest, error) {
    return db.GetContestByID(id)
}
```

```go
// emit/contestEmit.go
func ContestPageUpdated(contest *models.Contest) {
    if Server == nil {
        return
    }
    room := fmt.Sprintf("contest:%s", contest.ID)
    data, _ := json.Marshal(contest)
    Server.BroadcastToRoom("/", room, "contestPageUpdated", string(data))
    log.Printf("📤 Emitted contestPageUpdated to room: %s", room)
}

func ContestPageDeleted(contestID string) {
    if Server == nil {
        return
    }
    room := fmt.Sprintf("contest:%s", contestID)
    Server.BroadcastToRoom("/", room, "contestPageDeleted", "{}")
    log.Printf("📤 Emitted contestPageDeleted to room: %s", room)
}
```

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

# 🎯 Золотые правила

## Клиент
1. **View** — только читает, вызывает `init` и `clean` через `useEffect`
2. **Edit** — только пишет, вызывает `method`
3. **Call** — вызывается только из `init` и `method`
4. **Event** — вызывает только `update`-редьюсеры
5. **Комнаты** — автоматические, указываются через `{ room: 'entity{id}' }`
6. Никакой бизнес-логики на клиенте

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
- **Репозиторий:** [GitHub](https://github.com/Thying/US-GFECD-client)
- **Документация:** [US-GFECD Architecture](https://github.com/Thying/US-GFECD)

---

**Лицензия:** MIT