import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if(process.platform!=='win32') throw new Error('The desktop application supports Windows only.');
if(!process.env.JAVA_HOME) throw new Error('Set JAVA_HOME to a JDK 17 distribution.');
const output=path.join(root,'runtime');
try { await fs.access(path.join(output,'bin','java.exe')); }
catch { execFileSync(path.join(process.env.JAVA_HOME,'bin','jlink.exe'),['--add-modules','jdk.attach','--strip-debug','--no-header-files','--no-man-pages','--compress=2','--output',output],{stdio:'inherit',windowsHide:true}); }
await fs.copyFile(path.join(process.env.JAVA_HOME,'NOTICE'),path.join(output,'NOTICE'));
console.log('Windows Java Attach runtime ready.');
