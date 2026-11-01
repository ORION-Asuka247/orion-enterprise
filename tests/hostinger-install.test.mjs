import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import assert from 'node:assert/strict';

test('Hostinger installer preserves marketing/security rules, backs up the app and rejects corrupt releases', () => {
  const temp=mkdtempSync(join(tmpdir(),'orion-installer-'));
  try {
    const home=join(temp,'hosting'),site=join(home,'domains/asuka247.eu/public_html'),release=join(temp,'release');
    for (const path of [join(site,'app/assets'),join(release,'app/assets')]) mkdirSync(path,{recursive:true});
    writeFileSync(join(site,'index.html'),'MARKETING HOME');
    writeFileSync(join(site,'.htaccess'),'Options -Indexes\nHeader always set X-Frame-Options "SAMEORIGIN"\n');
    writeFileSync(join(site,'app/index.html'),'PREVIOUS APP');
    writeFileSync(join(site,'app/assets/previous.js'),'PREVIOUS BUNDLE');
    copyFileSync(new URL('../deploy/install-hostinger-app.sh',import.meta.url),join(release,'install-orion.sh'));
    const files={'app/index.html':'<script src="/app/assets/current.js"></script>','app/assets/current.js':'CURRENT BUNDLE','app/.htaccess':'RewriteEngine On\nRewriteRule ^assets/?$ index.html [L]\n'};
    for(const [path,content] of Object.entries(files)) writeFileSync(join(release,path),content);
    const manifest=Object.entries(files).map(([path,content])=>`${createHash('sha256').update(content).digest('hex')}  ${path}`).join('\n')+'\n';
    writeFileSync(join(release,'SHA256SUMS'),manifest);
    const run=()=>spawnSync('bash',[join(release,'install-orion.sh')],{encoding:'utf8',env:{...process.env,ORION_DEPLOY_HOME:home}});
    let result=run();assert.equal(result.status,0,result.stderr);
    assert.equal(readFileSync(join(site,'index.html'),'utf8'),'MARKETING HOME');
    assert.equal(readFileSync(join(site,'app/assets/previous.js'),'utf8'),'PREVIOUS BUNDLE');
    assert.equal(readFileSync(join(site,'app/assets/current.js'),'utf8'),'CURRENT BUNDLE');
    let rules=readFileSync(join(site,'.htaccess'),'utf8');assert.match(rules,/Options -Indexes/);assert.match(rules,/SAMEORIGIN/);
    const backup=join(home,'orion-backups',readdirSync(join(home,'orion-backups'))[0]);
    assert.equal(spawnSync('tar',['-xOf',join(backup,'app.tar.gz'),'app/index.html'],{encoding:'utf8'}).stdout,'PREVIOUS APP');
    assert.match(readFileSync(join(backup,'root.htaccess'),'utf8'),/SAMEORIGIN/);
    result=run();assert.equal(result.status,0,result.stderr);
    rules=readFileSync(join(site,'.htaccess'),'utf8');assert.equal(rules.split('# BEGIN ORION APP ROUTES').length-1,1);
    writeFileSync(join(release,'app/assets/current.js'),'CORRUPTED');result=run();assert.notEqual(result.status,0);
    assert.equal(readFileSync(join(site,'app/assets/current.js'),'utf8'),'CURRENT BUNDLE');
  } finally {rmSync(temp,{recursive:true,force:true});}
});
