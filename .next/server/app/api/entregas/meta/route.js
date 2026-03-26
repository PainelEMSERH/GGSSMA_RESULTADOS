"use strict";(()=>{var e={};e.id=6645,e.ids=[6645],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},95544:(e,a,t)=>{t.r(a),t.d(a,{originalPathname:()=>R,patchFetch:()=>O,requestAsyncStorage:()=>S,routeModule:()=>A,serverHooks:()=>m,staticGenerationAsyncStorage:()=>g});var r={};t.r(r),t.d(r,{GET:()=>d,dynamic:()=>c,runtime:()=>p});var o=t(87916),n=t(49930),i=t(2169),s=t(4389),l=t(27191),u=t(18789),E=t(30999);let p="nodejs",c="force-dynamic";async function d(e){try{let r=new URL(e.url),o=r.searchParams.get("regional")||"",n=r.searchParams.get("unidade")||"";if(!o)return s.NextResponse.json({ok:!1,error:"Regional \xe9 obrigat\xf3ria",meta:0});let i=[],p=o.trim(),c=n.trim(),d=await l.Z.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `),A=d?.[0]?.exists;p&&A&&i.push(`(UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${p.replace(/'/g,"''")}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
        SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${p.replace(/'/g,"''")}'))
      ))`),c&&(A?i.push(`(UPPER(TRIM(COALESCE(u.nmdepartamento, a.unidade_hospitalar, ''))) = UPPER(TRIM('${c.replace(/'/g,"''")}')) OR UPPER(TRIM(a.unidade_hospitalar)) = UPPER(TRIM('${c.replace(/'/g,"''")}')))`):i.push(`UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${c.replace(/'/g,"''")}'))`)),i.push("(a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = '')");let S=i.length?`WHERE ${i.join(" AND ")}`:"",g=A?`
      SELECT 
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.funcao, '') AS funcao,
        COALESCE(a.unidade_hospitalar, '') AS unidade_hospitalar
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      ${S}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    `:`
      SELECT 
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.funcao, '') AS funcao,
        COALESCE(a.unidade_hospitalar, '') AS unidade_hospitalar
      FROM stg_alterdata_v2 a
      ${S}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    `,m=await l.Z.$queryRawUnsafe(g);console.log(`[Meta API] Colaboradores encontrados: ${m.length} (pode ter CPFs duplicados se demitido e voltou em 2026)`);try{let e=m.map(e=>String(e.cpf||"").replace(/\D/g,"").slice(-11)).filter(e=>11===e.length);if(e.length>0){let a=await l.Z.$queryRawUnsafe(`
          SELECT cpf, situacao
          FROM colaborador_situacao_meta
          WHERE cpf = ANY($1::text[])
            AND situacao IN ('DEMITIDO_2026_SEM_EPI', 'DEMITIDO_2025_SEM_EPI', 'EXCLUIDO_META')
        `,e),t=new Set(a.map(e=>e.cpf));t.size>0&&(m=m.filter(e=>{let a=String(e.cpf||"").replace(/\D/g,"").slice(-11);return!t.has(a)}),console.log(`[Meta API] Removidos ${t.size} colaboradores marcados como "fora da meta"`))}}catch(e){console.warn("[Meta API] Erro ao filtrar colaboradores fora da meta:",e)}let R=[];try{R=await l.Z.$queryRawUnsafe(`
        SELECT
          COALESCE(pcg::text, '') AS pcg,
          COALESCE(alterdata_funcao::text, '') AS funcao,
          COALESCE(unidade_hospitalar::text, '') AS site,
          COALESCE(unidade_hospitalar::text, '') AS unidade_hosp,
          COALESCE(epi_item::text, '') AS item,
          COALESCE(quantidade::numeric, 1) AS qtd
        FROM stg_epi_map
      `),console.log(`[Meta API] Kits encontrados em stg_epi_map: ${R.length}`)}catch(e){return console.error("[Meta API] Erro ao buscar de stg_epi_map:",e?.message||e),s.NextResponse.json({ok:!1,error:`Erro ao buscar kits: ${String(e)}`,meta:0})}function a(e){return(e??"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"").toLowerCase()}function t(e){let t=(e??"").toString().replace(/\(A\)/gi,"").replace(/\s+/g," ");return a(t)}let O=e=>String(e??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim().includes("SEM SETOR"),f=e=>String(e??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim().includes("PCG UNIVERSAL"),C=Array.from(new Set(R.flatMap(e=>[e.funcao,e.funcao_norm,e.funcao_normalizada]).map(e=>String(e||"").trim()).filter(Boolean))),I=new Map,T=0;for(let e of m){let r=String(e.funcao||"").trim();if(!r)continue;let o=t(r);if(C.length>0){let e=(0,E.H)(r,C);e&&(o=t(e))}let n=0;if(I.has(o))n=I.get(o);else{let e=[],r=[];for(let a of R){let n=t(a.funcao_norm||a.funcao||""),i=t(a.funcao||"");if(n!==o&&i!==o)continue;let s=String(a.item||"").trim();if(!s||"SEM EPI"===s.toUpperCase()||!(0,u.M)(s)||!f(a.pcg))continue;let l=a.unidade_hosp||a.site||a.unidade_hospitalar;O(l)&&e.push(a),r.push(a)}let i=e.length>0?e:r,s=new Map;for(let e of i){let t=String(e.item||"").trim(),r=Number(e.qtd||1)||1;if(!t||r<=0)continue;let o=a(t),n=s.get(o);(!n||r>n)&&s.set(o,r)}n=Array.from(s.values()).reduce((e,a)=>e+a,0),I.set(o,n)}T+=n}return console.log(`[Meta API] Meta calculada: ${T} itens para ${m.length} colaboradores`),s.NextResponse.json({ok:!0,meta:T,colaboradores:m.length,regional:p,unidade:c||null})}catch(e){return console.error("Erro ao calcular meta:",e),s.NextResponse.json({ok:!1,error:String(e?.message||e),meta:0})}}let A=new o.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/entregas/meta/route",pathname:"/api/entregas/meta",filename:"route",bundlePath:"app/api/entregas/meta/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/entregas/meta/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:S,staticGenerationAsyncStorage:g,serverHooks:m}=A,R="/api/entregas/meta/route";function O(){return(0,i.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:g})}},18789:(e,a,t)=>{t.d(a,{M:()=>i,a:()=>s});let r=["M\xe1scara N95","Luva Nitr\xedlica","Luva nitr\xedlica para prote\xe7\xe3o qu\xedmica e biol\xf3gica","Bota de PVC","Bota PVC","Avental de PVC","\xd3culos de prote\xe7\xe3o","Luva de L\xe1tex","Luva L\xe1tex","Cinto de Seguran\xe7a","Talabarte de Seguran\xe7a","Avental de chumbo ou plumb\xedfero","\xd3culos plumb\xedferos","Protetores de g\xf4nadas","Protetores de tireoide","M\xe1scara 6200"];function o(e){return String(e||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim().replace(/\s+/g," ").replace(/[^A-Z0-9 ]/g,"")}let n=new Set([...r,"AVENTAL DE CHUMBO","AVENTAL PLUMBIFERO","AVENTAL PLUMBIFERO OU DE CHUMBO","OCULOS PLUMBIFERO","OCULOS PLUMBIFEROS","PROTETOR DE GONADAS","PROTETORES DE GONADAS","PROTETOR DE TIREOIDE","PROTETORES DE TIREOIDE"].map(e=>o(e)));function i(e){return!!e&&n.has(o(String(e)))}function s(e){let a=Array.from(new Set(r.map(e=>String(e).toUpperCase().trim()))).map(e=>`'${e.replace(/'/g,"''")}'`).join(", ");return`UPPER(TRIM(${e})) IN (${a})`}},30999:(e,a,t)=>{function r(e){return e?e.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\(A\)/g,"").replace(/\s+/g," ").trim():""}t.d(a,{H:()=>n});let o={"JOVEM APRENDIZ":"APRENDIZ - ASSISTENTE ADMINISTRATIVO","MENOR APRENDIZ - ASSISTENTE ADMINISTRATIVO":"APRENDIZ - ASSISTENTE ADMINISTRATIVO","ANALISTA AMBIENTAL":"ANALISTA DE MEIO AMBIENTE","ADMINISTRADOR HOSPITALAR":"COORDENADOR DE GESTAO HOSPITALAR"};function n(e,a){if(!e)return null;let t=r(e),n=a.find(e=>r(e)===t);if(n)return n;if(o[t]){let e=o[t];return a.find(a=>r(a)===r(e))||e}if(t.startsWith("MOTORISTA")){let e=a.find(e=>"MOTORISTA"===r(e));if(e)return e}return null}},27191:(e,a,t)=>{t.d(a,{Z:()=>o});var r=t(53524);let o=globalThis.prisma??new r.PrismaClient({log:["error"]})},87916:(e,a,t)=>{e.exports=t(30517)}};var a=require("../../../../webpack-runtime.js");a.C(e);var t=e=>a(a.s=e),r=a.X(0,[2035,4389],()=>t(95544));module.exports=r})();