# US-GFECD Architecture

**US-GFECD** — это архитектурный подход для построения масштабируемых realtime-приложений с чётким разделением ответственности на клиенте и сервере.

---

## 📖 Обзор

Аббревиатура расшифровывается как:

- **US** — Universal System (клиентская часть: UI + Store)
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

# 📱 Клиент (US — Universal System)

Клиентская часть состоит из двух основных компонентов: **UI** (интерфейс) и **Store** (состояние + логика).

## Структура клиента

```
src/
├── store/
│   ├── state/          # Данные + экшены
│   ├── init/           # Инициализация (createInit)
│   ├── event/          # Подписки (createSub)
│   └── method/         # Действия (createMethod)
├── ui/
│   ├── view/           # Компоненты-читатели (useInit)
│   ├── edit/           # Компоненты-писатели (method)
│   ├── widget/         # Группы view/edit
│   └── page/           # Страницы
└── index.js
```

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

### 4. Создайте Event (подписки)

```js
// src/store/event/userEvent.js
import { createSub } from '@us-gfecd/client'
import { addUser, setUsers } from '../state/userState'

export const userSub = createSub({
  userCreated: addUser,
  usersLoaded: setUsers
})
```

### 5. Создайте Init (инициализация)

```js
// src/store/init/userInit.js
import { createInit } from '@us-gfecd/client'
import { setUsers, setLoading } from '../state/userState'
import { userSub } from '../event/userEvent'

export const { init, clean, selectors } = createInit({
  call: 'getUsers',
  save: setUsers,
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
// src/ui/view/UserListView.jsx
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useInit } from '@us-gfecd/client'
import { init, clean, selectors } from '../../store/init/userInit'

export const UserListView = () => {
  const dispatch = useDispatch()
  const users = useSelector(state => state.user.list)
  const { loading, error } = useSelector(selectors.selectState)

  useInit(() => dispatch(init()), () => dispatch(clean()))

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

---

## API клиента

### `createInit({ call, save, sub })`

Создаёт thunk для инициализации данных.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `call` | `string` | Имя события Socket.IO для запроса данных |
| `save` | `Function` | Экшен для сохранения данных |
| `sub` | `Function` | Подписка (результат `createSub`) |

**Возвращает:** `{ init, clean, selectors }`

- `init` — thunk для загрузки данных
- `clean` — thunk для очистки данных и отписки
- `selectors` — селекторы для чтения состояния (`selectState`, `selectLoading`, `selectError`, `selectInitialized`)

### `createSub(handlers)`

Создаёт подписку на события сервера.

```js
createSub({
  userCreated: addUser,
  userDeleted: removeUser,
  userUpdated: updateUser
})
```

**Возвращает:** функцию `subscribe(dispatch)`, которая возвращает `unsubscribe`

### `createMethod({ call, save })`

Создаёт thunk для отправки запросов.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `call` | `string` | Имя события Socket.IO |
| `save` | `Function` | Экшен для сохранения результата |

**Возвращает:** thunk `(data) => dispatch => { ... }`

### `useInit(init, clean, deps?)`

Хук для управления жизненным циклом компонента.

```js
useInit(
  () => dispatch(init()),
  () => dispatch(clean())
)
```

- Автоматически вызывает `init` при монтировании
- Автоматически вызывает `clean` при размонтировании
- `deps` — зависимости для `useEffect`

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

## Потоки данных на клиенте

### Инициализация
1. View монтируется → `useInit` вызывает `init()`
2. `init` проверяет флаги (`loading`, `initialized`)
3. Если данные не загружены → `socket.emit(call)`
4. Полученные данные сохраняются через `save`
5. Активируется подписка `sub`
6. View отображает данные

### Realtime обновление
1. Сервер присылает событие (например, `userCreated`)
2. `createSub` вызывает соответствующий экшен
3. Store обновляется → View перерисовывается

### Действие пользователя
1. Edit вызывает `method(data)`
2. `method` отправляет запрос через `socket.emit(call, data)`
3. Полученный ответ сохраняется через `save`
4. View перерисовывается

### Деинициализация
1. View размонтируется → `useInit` вызывает `clean()`
2. `clean` уменьшает счётчик подписчиков
3. Если это последний компонент → отписка от событий + очистка данных

---

# 🖥️ Сервер (GFECD)

Серверная часть построена на микросервисной архитектуре с чёткими слоями.

## Структура сервера

```
server/
├── gate/           # Входной адаптер
│   └── userGate.js
├── flow/           # Оркестрация сценариев
│   ├── userFlow.js
│   └── atomic/     # Атомарные сценарии
│       └── checkAccessFlow.js
├── core/           # Бизнес-логика
│   └── userCore.js
├── db/             # Доступ к данным
│   └── userDb.js
└── emit/           # Исходящие события
    └── userEmit.js
```

## Слои сервера

### Gate (входной адаптер)

**Назначение:** принимает запросы, проверяет авторизацию, валидирует данные, вызывает ровно один Flow.

**Пример:**

```js
// gate/userGate.js
export const userGate = (socket) => {
  socket.on('getUsers', async (_, callback) => {
    // Проверка авторизации
    // Вызов Flow
    const users = await userFlow.getUsers(socket.userId)
    callback(users)
  })

  socket.on('createUser', async (data, callback) => {
    const user = await userFlow.createUser(data)
    callback(user)
  })
}
```

**Разрешено:**
- ✅ Вызывать Flow
- ✅ Проверять авторизацию
- ✅ Валидировать входные данные

**Запрещено:**
- ❌ Содержать бизнес-логику
- ❌ Работать с БД напрямую
- ❌ Вызывать Emit

---

### Flow (оркестрация)

**Назначение:** координирует выполнение бизнес-процессов, управляет транзакциями.

**Пример обычного Flow:**

```js
// flow/userFlow.js
import { checkAccessFlow } from './atomic/checkAccessFlow'
import { userCore } from '../core/userCore'
import { userDb } from '../db/userDb'
import { userEmit } from '../emit/userEmit'

export const userFlow = {
  async createUser(data) {
    // 1. Проверка прав
    await checkAccessFlow(data.userId, 'createUser')
    
    // 2. Валидация данных
    const validatedData = userCore.validateUser(data)
    
    // 3. Сохранение в БД
    const user = await userDb.create(validatedData)
    
    // 4. Отправка события
    userEmit.userCreated(user)
    
    return user
  },

  async getUsers() {
    const users = await userDb.findAll()
    return users
  }
}
```

**Атомарный Flow (не вызывает другие Flow):**

```js
// flow/atomic/checkAccessFlow.js
import { userDb } from '../db/userDb'

export const checkAccessFlow = async (userId, action) => {
  const user = await userDb.findById(userId)
  const hasAccess = user.roles.includes('admin')
  if (!hasAccess) {
    throw new Error('Access denied')
  }
  return true
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

```js
// core/userCore.js
export const userCore = {
  validateUser(data) {
    if (!data.name || data.name.length < 2) {
      throw new Error('Name is too short')
    }
    return { ...data, validated: true }
  },

  calculateAge(birthDate) {
    return new Date().getFullYear() - new Date(birthDate).getFullYear()
  },

  formatUser(user) {
    return {
      id: user.id,
      fullName: `${user.firstName} ${user.lastName}`,
      age: this.calculateAge(user.birthDate)
    }
  }
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

```js
// db/userDb.js
import { db } from '../base/baseDb'

export const userDb = {
  async create(data) {
    return db.user.create({ data })
  },

  async findAll() {
    return db.user.findMany()
  },

  async findById(id) {
    return db.user.findUnique({ where: { id } })
  },

  async isUserInRoom(userId, roomId) {
    const membership = await db.membership.findFirst({
      where: { userId, roomId }
    })
    return !!membership
  }
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

**Пример:**

```js
// emit/userEmit.js
export const userEmit = (io) => ({
  userCreated(user) {
    io.emit('userCreated', user)
  },

  userDeleted(userId) {
    io.emit('userDeleted', userId)
  },

  userUpdated(user) {
    io.emit('userUpdated', user)
  },

  notifyRoom(roomId, event, data) {
    io.to(`room:${roomId}`).emit(event, data)
  }
})
```

**Разрешено:**
- ✅ Отправлять события
- ✅ Форматировать сообщения
- ✅ Обрабатывать acknowledgment

**Запрещено:**
- ❌ Содержать бизнес-логику
- ❌ Импортировать Gate, Flow, Core, Db

---

## Потоки данных на сервере

### Запрос от клиента
1. Gate принимает запрос
2. Gate вызывает Flow
3. Flow вызывает Core (валидация, расчёты)
4. Flow вызывает Db (сохранение/чтение)
5. Flow вызывает Emit (если нужно уведомить других)
6. Ответ возвращается через Gate

### Realtime событие
1. Flow вызывает Emit
2. Emit отправляет событие клиентам через WebSocket

---

# 🚀 Полный пример

## Клиент

```js
// src/store/state/todoState.js
import { createSlice } from '@reduxjs/toolkit'

const todoSlice = createSlice({
  name: 'todo',
  initialState: { list: [] },
  reducers: {
    setTodos: (state, action) => { state.list = action.payload },
    addTodo: (state, action) => { state.list.push(action.payload) }
  }
})

export const { setTodos, addTodo } = todoSlice.actions
```

```js
// src/store/event/todoEvent.js
import { createSub } from '@us-gfecd/client'
import { addTodo } from '../state/todoState'

export const todoSub = createSub({
  todoCreated: addTodo
})
```

```js
// src/store/init/todoInit.js
import { createInit } from '@us-gfecd/client'
import { setTodos } from '../state/todoState'
import { todoSub } from '../event/todoEvent'

export const { init, clean, selectors } = createInit({
  call: 'getTodos',
  save: setTodos,
  sub: todoSub
})
```

```jsx
// src/ui/view/TodoListView.jsx
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useInit } from '@us-gfecd/client'
import { init, clean } from '../../store/init/todoInit'

export const TodoListView = () => {
  const dispatch = useDispatch()
  const todos = useSelector(state => state.todo.list)

  useInit(() => dispatch(init()), () => dispatch(clean()))

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  )
}
```

## Сервер (Node.js + Socket.IO)

```js
// server.js
import { createServer } from 'http'
import { Server } from 'socket.io'
import { userGate } from './gate/userGate'
import { todoGate } from './gate/todoGate'

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: { origin: '*' }
})

// Регистрация Gate
io.on('connection', (socket) => {
  userGate(socket)
  todoGate(socket)
})

httpServer.listen(3000)
```

```js
// gate/todoGate.js
import { todoFlow } from '../flow/todoFlow'

export const todoGate = (socket) => {
  socket.on('getTodos', async (_, callback) => {
    const todos = await todoFlow.getTodos()
    callback(todos)
  })

  socket.on('createTodo', async (data, callback) => {
    const todo = await todoFlow.createTodo(data)
    callback(todo)
  })
}
```

```js
// flow/todoFlow.js
import { todoCore } from '../core/todoCore'
import { todoDb } from '../db/todoDb'
import { todoEmit } from '../emit/todoEmit'

export const todoFlow = {
  async getTodos() {
    return todoDb.findAll()
  },

  async createTodo(data) {
    const validated = todoCore.validateTodo(data)
    const todo = await todoDb.create(validated)
    todoEmit.todoCreated(todo)
    return todo
  }
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
1. **View** — только читает, вызывает `useInit`
2. **Edit** — только пишет, вызывает `method`
3. **Call** — вызывается только из `init` и `method`
4. **Event** — вызывает только `update`-редьюсеры
5. Никакой бизнес-логики на клиенте

## Сервер
1. **Gate** → один Flow
2. **Flow** → Core + Db + Emit
3. **Core** — только чистая логика
4. **Db** — только данные
5. **Emit** — только отправка

---

# 📚 Ссылки

- **Библиотека:** [@us-gfecd/client](https://npmjs.com/package/@us-gfecd/client)
- **Репозиторий:** [GitHub](https://github.com/Thying/US-GFECD-client)
- **Документация:** [US-GFECD Architecture](https://github.com/Thying/US-GFECD)

---

**Лицензия:** MIT