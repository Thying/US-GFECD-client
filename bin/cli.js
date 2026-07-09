#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const STRUCTURE = {
  'src/store/state': '// state files here (initialState + reducers)',
  'src/store/entity': '// entity files here (createEntity)',
  'src/store/method': '// method files here (createMethod)',
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
export * from './entity'
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
// Export your state files (initialState + reducers)
// Example:
// export * from './contestStatusState'
`,
  'src/store/entity/index.js': `
// Export your entities (createEntity)
// Example:
// export { contestStatus } from './contestStatusEntity'
`,
  'src/store/method/index.js': `
// Export your methods (createMethod)
// Example:
// export { createUser } from './userMethod'
`,
  'src/ui/view/index.js': `
// Export your view components
// Example:
// export { ContestStatusView } from './ContestStatusView'
`,
  'src/ui/edit/index.js': `
// Export your edit components
// Example:
// export { CreateUserForm } from './CreateUserForm'
`,
  'src/ui/widget/index.js': `
// Export your widgets
// Example:
// export { UserWidget } from './UserWidget'
`,
  'src/ui/page/index.js': `
// Export your pages
// Example:
// export { MainPage } from './MainPage'
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
  console.log('  1. Create state files in src/store/state/ (initialState + reducers)')
  console.log('  2. Create entities in src/store/entity/ (createEntity with handlers)')
  console.log('  3. Create methods in src/store/method/ (createMethod)')
  console.log('  4. Create UI components in src/ui/')
}

// Запуск
const command = process.argv[2]
if (command === 'init') {
  createStructure()
} else {
  console.log('Usage: npx us-gfecd init')
}