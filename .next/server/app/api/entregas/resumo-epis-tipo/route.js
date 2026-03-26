"use strict";(()=>{var e={};e.id=5190,e.ids=[5190],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},98318:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>d,patchFetch:()=>R,requestAsyncStorage:()=>g,routeModule:()=>A,serverHooks:()=>f,staticGenerationAsyncStorage:()=>m});var a={};r.r(a),r.d(a,{GET:()=>S,dynamic:()=>c,runtime:()=>E});var n=r(87916),i=r(49930),o=r(2169),s=r(4389),l=r(27191),p=r(18789),u=r(30999);let E="nodejs",c="force-dynamic";async function S(e){try{let a=new URL(e.url),n=a.searchParams.get("regional")||"",i=parseInt(a.searchParams.get("ano")||"2026",10);if(!n)return s.NextResponse.json({ok:!1,error:"Regional \xe9 obrigat\xf3ria",resumo:[]});let o=await l.Z.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `);if(!o?.[0]?.exists)return s.NextResponse.json({ok:!1,error:"Tabela stg_unid_reg n\xe3o encontrada",resumo:[]});let E=n.trim(),c=`
      SELECT DISTINCT
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.funcao, '') AS funcao,
        COALESCE(NULLIF(TRIM(u.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') AS unidade_hospitalar
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      WHERE (UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${E.replace(/'/g,"''")}')) 
             OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
               SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${E.replace(/'/g,"''")}'))
             ))
        AND (a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = '')
        AND COALESCE(a.cpf, '') != ''
        AND COALESCE(a.funcao, '') != ''
    `,S=await l.Z.$queryRawUnsafe(c);try{let e=S.map(e=>String(e.cpf||"").replace(/\D/g,"").slice(-11)).filter(e=>11===e.length);if(e.length>0){let t=await l.Z.$queryRawUnsafe(`
          SELECT cpf, situacao
          FROM colaborador_situacao_meta
          WHERE cpf = ANY($1::text[])
            AND situacao IN ('DEMITIDO_2026_SEM_EPI', 'DEMITIDO_2025_SEM_EPI', 'EXCLUIDO_META')
        `,e),r=new Set(t.map(e=>e.cpf));r.size>0&&(S=S.filter(e=>{let t=String(e.cpf||"").replace(/\D/g,"").slice(-11);return!r.has(t)}))}}catch(e){console.warn("[Resumo EPIs] Erro ao filtrar colaboradores fora da meta:",e)}let A=await l.Z.$queryRawUnsafe(`
      SELECT
        COALESCE(pcg, '') AS pcg,
        COALESCE(alterdata_funcao, '') AS funcao,
        COALESCE(funcao_normalizada, alterdata_funcao, '') AS funcao_norm,
        COALESCE(unidade_hospitalar, '') AS unidade_hosp,
        COALESCE(epi_item, '') AS item,
        COALESCE(quantidade::numeric, 1) AS qtd
      FROM stg_epi_map
    `),g=S.map(e=>String(e.cpf||"").replace(/\D/g,"").slice(-11)).filter(e=>11===e.length),m=[];if(g.length>0){let e=`
        SELECT
          regexp_replace(COALESCE(TRIM(cpf), ''), '[^0-9]', '', 'g') AS cpf,
          COALESCE(item::text, '') AS item,
          COALESCE(deliveries::jsonb, '[]'::jsonb) AS deliveries
        FROM epi_entregas
        WHERE regexp_replace(COALESCE(TRIM(cpf), ''), '[^0-9]', '', 'g') = ANY($1::text[])
      `;m=await l.Z.$queryRawUnsafe(e,g)}function t(e){return(e??"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"").toLowerCase()}function r(e){let r=(e??"").toString().replace(/\(A\)/gi,"").replace(/\s+/g," ");return t(r)}let f=new Map,d=Array.from(new Set(A.map(e=>e.funcao).filter(Boolean)));for(let e of S){let a=String(e.funcao||"").trim();if(!a)continue;let n=r(a);if(d.length>0){let e=(0,u.H)(a,d);e&&(n=r(e))}let i=e=>String(e??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim().includes("SEM SETOR"),o=e=>String(e??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim().includes("PCG UNIVERSAL"),s=[],l=[];for(let e of A){let t=r(e.funcao_norm||e.funcao||""),a=r(e.funcao||"");if(t!==n&&a!==n)continue;let u=String(e.item||"").trim();u&&"SEM EPI"!==u.toUpperCase()&&(0,p.M)(u)&&o(e.pcg)&&(i(e.unidade_hosp)&&s.push(e),l.push(e))}let E=s.length>0?s:l,c=new Map;for(let e of E){let r=String(e.item||"").trim();if(!r)continue;let a=Number(e.qtd||1)||1;if(a<=0)continue;let n=t(r),i=c.get(n);(!i||a>i)&&c.set(n,a)}for(let[e,r]of c.entries()){let a=A.find(r=>t(String(r.item||"").trim())===e)?.item||e,n=f.get(a)||0;f.set(a,n+r)}}let R=new Map;for(let e of m){let t=String(e.item||"").trim();if(t&&(0,p.M)(t))for(let r of Array.isArray(e.deliveries)?e.deliveries:[]){if(!r.date||!r.qty)continue;let[e]=String(r.date).substring(0,10).split("-");if(parseInt(e,10)===i){let e=Number(r.qty||0);if(e>0){let r=R.get(t)||0;R.set(t,r+e)}}}}let O=new Set([...f.keys(),...R.keys()]),I=Array.from(O).map(e=>{let t=f.get(e)||0,r=R.get(e)||0;return{item:e,previsto:t,entregue:r,pendente:Math.max(0,t-r)}}).filter(e=>e.previsto>0).sort((e,t)=>t.pendente!==e.pendente?t.pendente-e.pendente:e.item.localeCompare(t.item));return s.NextResponse.json({ok:!0,resumo:I,ano:i})}catch(e){return console.error("Erro ao calcular resumo de EPIs por tipo:",e),s.NextResponse.json({ok:!1,error:String(e?.message||e),resumo:[]})}}let A=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/entregas/resumo-epis-tipo/route",pathname:"/api/entregas/resumo-epis-tipo",filename:"route",bundlePath:"app/api/entregas/resumo-epis-tipo/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/entregas/resumo-epis-tipo/route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:g,staticGenerationAsyncStorage:m,serverHooks:f}=A,d="/api/entregas/resumo-epis-tipo/route";function R(){return(0,o.patchFetch)({serverHooks:f,staticGenerationAsyncStorage:m})}},18789:(e,t,r)=>{r.d(t,{M:()=>o,a:()=>s});let a=["M\xe1scara N95","Luva Nitr\xedlica","Luva nitr\xedlica para prote\xe7\xe3o qu\xedmica e biol\xf3gica","Bota de PVC","Bota PVC","Avental de PVC","\xd3culos de prote\xe7\xe3o","Luva de L\xe1tex","Luva L\xe1tex","Cinto de Seguran\xe7a","Talabarte de Seguran\xe7a","Avental de chumbo ou plumb\xedfero","\xd3culos plumb\xedferos","Protetores de g\xf4nadas","Protetores de tireoide","M\xe1scara 6200"];function n(e){return String(e||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim().replace(/\s+/g," ").replace(/[^A-Z0-9 ]/g,"")}let i=new Set([...a,"AVENTAL DE CHUMBO","AVENTAL PLUMBIFERO","AVENTAL PLUMBIFERO OU DE CHUMBO","OCULOS PLUMBIFERO","OCULOS PLUMBIFEROS","PROTETOR DE GONADAS","PROTETORES DE GONADAS","PROTETOR DE TIREOIDE","PROTETORES DE TIREOIDE"].map(e=>n(e)));function o(e){return!!e&&i.has(n(String(e)))}function s(e){let t=Array.from(new Set(a.map(e=>String(e).toUpperCase().trim()))).map(e=>`'${e.replace(/'/g,"''")}'`).join(", ");return`UPPER(TRIM(${e})) IN (${t})`}},30999:(e,t,r)=>{function a(e){return e?e.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\(A\)/g,"").replace(/\s+/g," ").trim():""}r.d(t,{H:()=>i});let n={"JOVEM APRENDIZ":"APRENDIZ - ASSISTENTE ADMINISTRATIVO","MENOR APRENDIZ - ASSISTENTE ADMINISTRATIVO":"APRENDIZ - ASSISTENTE ADMINISTRATIVO","ANALISTA AMBIENTAL":"ANALISTA DE MEIO AMBIENTE","ADMINISTRADOR HOSPITALAR":"COORDENADOR DE GESTAO HOSPITALAR"};function i(e,t){if(!e)return null;let r=a(e),i=t.find(e=>a(e)===r);if(i)return i;if(n[r]){let e=n[r];return t.find(t=>a(t)===a(e))||e}if(r.startsWith("MOTORISTA")){let e=t.find(e=>"MOTORISTA"===a(e));if(e)return e}return null}},27191:(e,t,r)=>{r.d(t,{Z:()=>n});var a=r(53524);let n=globalThis.prisma??new a.PrismaClient({log:["error"]})},87916:(e,t,r)=>{e.exports=r(30517)}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[2035,4389],()=>r(98318));module.exports=a})();