/*
|--------------------------------------------------------------------------
| Configure hook
|--------------------------------------------------------------------------
|
| The configure hook is called when someone runs "node ace configure <package>"
| command. You are free to perform any operations inside this function to
| configure the package.
|
| To make things easier, you have access to the underlying "Configure"
| instance and you can use codemods to modify the source files.
|
*/

import type Configure from '@adonisjs/core/commands/configure'

export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  await codemods.makeUsingStub(command.stubsRoot, 'config/cloudinary.stub', {})
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@rikology/adonisjs-cloudinary/cloudinary_provider')
  })
}
