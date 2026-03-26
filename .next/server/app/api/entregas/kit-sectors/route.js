"use strict";(()=>{var e={};e.id=2426,e.ids=[2426],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},76933:(e,a,r)=>{r.r(a),r.d(a,{originalPathname:()=>I,patchFetch:()=>O,requestAsyncStorage:()=>S,routeModule:()=>p,serverHooks:()=>T,staticGenerationAsyncStorage:()=>c});var t={};r.r(t),r.d(t,{GET:()=>d,dynamic:()=>A,runtime:()=>R});var n=r(87916),i=r(49930),o=r(2169),s=r(4389),u=r(27191),E=r(30999),l=r(33624);let R="nodejs",A="force-dynamic";async function d(e){try{let{searchParams:a}=new URL(e.url),r=(a.get("funcao")||"").trim();if(!r)return s.NextResponse.json({ok:!0,sectors:[]});let t=null;try{t=await (0,l.X)(u.Z,r)}catch(e){console.warn("[kit-sectors] erro ao resolver funcao_normalizada:",e)}let n=(await u.Z.$queryRawUnsafe(`
      SELECT DISTINCT COALESCE(funcao_normalizada, alterdata_funcao) AS func_name
      FROM stg_epi_map
      WHERE alterdata_funcao IS NOT NULL
    `)||[]).map(e=>e?.func_name).filter(Boolean),i=t||(0,E.H)(r,n)||r,o=(await u.Z.$queryRawUnsafe(`
        SELECT DISTINCT TRIM(COALESCE(unidade_hospitalar, '')) AS unidade_hospitalar
        FROM stg_epi_map
        WHERE TRIM(COALESCE(unidade_hospitalar, '')) <> ''
          AND TRIM(COALESCE(unidade_hospitalar, '')) NOT IN ('PCG UNIVERSAL', 'SEM MAPEAMENTO NO PCG')
          AND (
            UPPER(TRIM(COALESCE(funcao_normalizada, ''))) = UPPER(TRIM($1))
            OR UPPER(TRIM(COALESCE(alterdata_funcao, ''))) = UPPER(TRIM($2))
          )
        ORDER BY unidade_hospitalar ASC
      `,i,r)||[]).map(e=>String(e?.unidade_hospitalar||"").trim()).filter(Boolean);if(o.length>0)return s.NextResponse.json({ok:!0,sectors:o});let R=`%${r}%`,A=(await u.Z.$queryRawUnsafe(`
        SELECT DISTINCT TRIM(COALESCE(unidade_hospitalar, '')) AS unidade_hospitalar
        FROM stg_epi_map
        WHERE TRIM(COALESCE(unidade_hospitalar, '')) <> ''
          AND TRIM(COALESCE(unidade_hospitalar, '')) NOT IN ('PCG UNIVERSAL', 'SEM MAPEAMENTO NO PCG')
          AND (
            UPPER(TRIM(COALESCE(funcao_normalizada, ''))) LIKE UPPER(TRIM($1))
            OR UPPER(TRIM(COALESCE(alterdata_funcao, ''))) LIKE UPPER(TRIM($1))
          )
        ORDER BY unidade_hospitalar ASC
      `,R)||[]).map(e=>String(e?.unidade_hospitalar||"").trim()).filter(Boolean);return s.NextResponse.json({ok:!0,sectors:A})}catch(e){return console.error("[kit-sectors] error",e),s.NextResponse.json({ok:!1,error:String(e?.message||e),sectors:[]},{status:500})}}let p=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/entregas/kit-sectors/route",pathname:"/api/entregas/kit-sectors",filename:"route",bundlePath:"app/api/entregas/kit-sectors/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/entregas/kit-sectors/route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:S,staticGenerationAsyncStorage:c,serverHooks:T}=p,I="/api/entregas/kit-sectors/route";function O(){return(0,o.patchFetch)({serverHooks:T,staticGenerationAsyncStorage:c})}},33624:(e,a,r)=>{r.d(a,{X:()=>t});async function t(e,a){let r=String(a||"").trim();if(!r)return null;let t=String(r||"").replace(/\(A\)/gi,"").replace(/\s+/g," ").trim(),n=async a=>{let r=await e.$queryRawUnsafe(`
      SELECT funcao_normalizada
      FROM stg_epi_map
      WHERE UPPER(TRIM(COALESCE(alterdata_funcao, ''))) = UPPER(TRIM($1))
        AND TRIM(COALESCE(funcao_normalizada, '')) <> ''
      GROUP BY funcao_normalizada
      ORDER BY COUNT(*) DESC, funcao_normalizada ASC
      LIMIT 1
      `,a);return(r?.[0]?.funcao_normalizada?String(r[0].funcao_normalizada).trim():"")||null},i=await n(r);if(i)return i;if(t&&t!==r){let e=await n(t);if(e)return e}return null}},30999:(e,a,r)=>{function t(e){return e?e.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\(A\)/g,"").replace(/\s+/g," ").trim():""}r.d(a,{H:()=>i});let n={"JOVEM APRENDIZ":"APRENDIZ - ASSISTENTE ADMINISTRATIVO","MENOR APRENDIZ - ASSISTENTE ADMINISTRATIVO":"APRENDIZ - ASSISTENTE ADMINISTRATIVO","ANALISTA AMBIENTAL":"ANALISTA DE MEIO AMBIENTE","ADMINISTRADOR HOSPITALAR":"COORDENADOR DE GESTAO HOSPITALAR"};function i(e,a){if(!e)return null;let r=t(e),i=a.find(e=>t(e)===r);if(i)return i;if(n[r]){let e=n[r];return a.find(a=>t(a)===t(e))||e}if(r.startsWith("MOTORISTA")){let e=a.find(e=>"MOTORISTA"===t(e));if(e)return e}return null}},27191:(e,a,r)=>{r.d(a,{Z:()=>n});var t=r(53524);let n=globalThis.prisma??new t.PrismaClient({log:["error"]})},87916:(e,a,r)=>{e.exports=r(30517)}};var a=require("../../../../webpack-runtime.js");a.C(e);var r=e=>a(a.s=e),t=a.X(0,[2035,4389],()=>r(76933));module.exports=t})();