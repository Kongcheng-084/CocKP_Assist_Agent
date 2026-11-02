const {spawn}=require('node:child_process'),path=require('node:path');const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(path.resolve('node_modules/electron/dist/electron.exe'),['scripts/profile-pdf-import.mjs',...process.argv.slice(2)],{env,windowsHide:true,stdio:'inherit'});child.on('exit',code=>process.exit(code??1));
