"use strict";(()=>{var a={};a.id=8474,a.ids=[8474,5892],a.modules={53524:a=>{a.exports=require("@prisma/client")},20399:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},16229:(a,e,s)=>{s.r(e),s.d(e,{originalPathname:()=>c,patchFetch:()=>T,requestAsyncStorage:()=>u,routeModule:()=>n,serverHooks:()=>p,staticGenerationAsyncStorage:()=>N});var d={};s.r(d),s.d(d,{GET:()=>m});var t=s(87916),r=s(49930),o=s(2169),i=s(4389),E=s(65892);async function m(a){try{let a="2026-01-01",e=`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN 1 END) as formato_iso,
        COUNT(CASE WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN 1 END) as formato_br,
        COUNT(CASE WHEN 
          CASE 
            WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::date
            WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')
            ELSE NULL
          END = '${a}'::date
        THEN 1 END) as com_data_01_01_2026
      FROM stg_alterdata_v2 a
    `,s=`
      SELECT DISTINCT
        a.admissao,
        CASE 
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::date::text
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')::text
          ELSE NULL
        END as data_parseada,
        COUNT(*) as quantidade
      FROM stg_alterdata_v2 a
      WHERE a.admissao IS NOT NULL AND a.admissao != ''
      GROUP BY a.admissao
      ORDER BY quantidade DESC
      LIMIT 20
    `,d=`
      SELECT 
        a.cpf,
        a.colaborador,
        a.admissao,
        CASE 
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::date::text
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')::text
          ELSE NULL
        END as data_parseada
      FROM stg_alterdata_v2 a
      WHERE (
        CASE 
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::date
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')
          ELSE NULL
        END
      ) = '${a}'::date
      LIMIT 10
    `,t=await E.prisma.$queryRawUnsafe(e),r=await E.prisma.$queryRawUnsafe(s),o=await E.prisma.$queryRawUnsafe(d);return i.NextResponse.json({ok:!0,estatisticas:t[0],amostras_datas:r,candidatos_01_01_2026:o})}catch(a){return console.error("[ordem-servico/debug] error",a),i.NextResponse.json({ok:!1,error:String(a?.message||a)},{status:500})}}let n=new t.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/ordem-servico/debug/route",pathname:"/api/ordem-servico/debug",filename:"route",bundlePath:"app/api/ordem-servico/debug/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/ordem-servico/debug/route.ts",nextConfigOutput:"",userland:d}),{requestAsyncStorage:u,staticGenerationAsyncStorage:N,serverHooks:p}=n,c="/api/ordem-servico/debug/route";function T(){return(0,o.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:N})}},65892:(a,e,s)=>{s.d(e,{prisma:()=>t});var d=s(53524);let t=globalThis.prisma??new d.PrismaClient({log:["error","warn"]})},87916:(a,e,s)=>{a.exports=s(30517)}};var e=require("../../../../webpack-runtime.js");e.C(a);var s=a=>e(e.s=a),d=e.X(0,[2035,4389],()=>s(16229));module.exports=d})();