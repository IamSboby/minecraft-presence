import path from 'node:path';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
if(process.platform==='win32'){
 const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));const compiler=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
 await fs.mkdir(path.join(root,'native/dist'),{recursive:true});
 execFileSync(compiler,['/nologo','/target:exe','/reference:System.Web.Extensions.dll','/out:'+path.join(root,'native/dist/ProcessScanner.exe'),path.join(root,'native/ProcessScanner.cs')],{stdio:'inherit',windowsHide:true});
}
