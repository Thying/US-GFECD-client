#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const STRUCTURE = {
  'src/store/state': '// state files here',
  'src/store/init': '// init files here',
  'src/store/event': '// event files here',
  'src/store/method': '// method files here',
  'src/ui/view': '// view components here',
  'src/ui/edit': '// edit components here',
  'src/ui/widget': '// widget components here',
  'src/ui/page': '// page components here',
}

const FILES = {
  'src/index.js': `
// Main entry point
export * from './store'
export * from './ui'
`,
  'src/store/index.js': `
// Store exports
export * from './state'
export * from './init'
export * from './event'
export * from './method'
`,
  'src/ui/index.js': `
// UI exports
export * from './view'
export * from './edit'
export * from './widget'
export * from './page'
`,
  'src/store/state/index.js': `
// Export your state slices here
// Example:
// export { default as user } from './userState'
`,
  'src/store/init/index.js': `
// Export your init functions here
// Example:
// export { initUsers, cleanUsers, selectors } from './userInit'
`,
  'src/store/event/index.js': `
// Export your event subscriptions here
// Example:
// export { userSub } from './userEvent'
`,
  'src/store/method/index.js': `
// Export your methods here
// Example:
// export { createUser } from './userMethod'
`,
  'src/ui/view/index.js': `
// Export your view components here
// Example:
// export { UserListView } from './UserListView'
`,
  'src/ui/edit/index.js': `
// Export your edit components here
// Example:
// export { CreateUserForm } from './CreateUserForm'
`,
  'src/ui/widget/index.js': `
// Export your widgets here
// Example:
// export { UserWidget } from './UserWidget'
`,
  'src/ui/page/index.js': `
// Export your pages here
// Example:
// export { UsersPage } from './UsersPage'
`,
}

const createStructure = () => {
  const rootDir = process.cwd()
  console.log('📁 Creating US-GFECD structure...')

  // Создаём папки
  Object.keys(STRUCTURE).forEach((folder) => {
    const fullPath = path.join(rootDir, folder)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true })
      console.log(`  ✅ Created folder: ${folder}`)
    } else {
      console.log(`  ⏩ Folder already exists: ${folder}`)
    }
  })

  // Создаём файлы
  Object.keys(FILES).forEach((file) => {
    const fullPath = path.join(rootDir, file)
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, FILES[file].trim())
      console.log(`  ✅ Created file: ${file}`)
    } else {
      console.log(`  ⏩ File already exists: ${file}`)
    }
  })

  console.log('\n🎉 US-GFECD structure created successfully!')
  console.log('\nNext steps:')
  console.log('  1. Create your state slices in src/store/state/')
  console.log('  2. Create init functions in src/store/init/')
  console.log('  3. Create event subscriptions in src/store/event/')
  console.log('  4. Create methods in src/store/method/')
  console.log('  5. Create UI components in src/ui/')
}

// Запуск
const command = process.argv[2]
if (command === 'init') {
  createStructure()
} else {
  console.log('Usage: npx us-gfecd init')
}