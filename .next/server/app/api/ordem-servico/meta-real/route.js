"use strict";(()=>{var e={};e.id=8386,e.ids=[8386,5892],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},26495:(e,a,r)=>{r.r(a),r.d(a,{originalPathname:()=>l,patchFetch:()=>p,requestAsyncStorage:()=>N,routeModule:()=>n,serverHooks:()=>m,staticGenerationAsyncStorage:()=>R});var t={};r.r(t),r.d(t,{GET:()=>E});var s=r(87916),o=r(49930),d=r(2169),i=r(4389),T=r(65892);async function E(e){try{await T.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ordem_servico (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        colaborador_cpf TEXT NOT NULL,
        entregue BOOLEAN NOT NULL DEFAULT false,
        data_entrega DATE,
        responsavel TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(colaborador_cpf)
      );
    `),await T.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_colaborador_cpf ON ordem_servico(colaborador_cpf);
    `),await T.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_data_entrega ON ordem_servico(data_entrega);
    `);let a=new URL(e.url),r=a.searchParams.get("regional")||"",t=a.searchParams.get("ano")||String(new Date().getFullYear()),s=parseInt(t,10),o=[];o.push(`(
      a.demissao IS NULL
      OR a.demissao = ''
      OR TRIM(a.demissao) = ''
      OR (
        CASE
          WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
          WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
          WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
          ELSE NULL
        END
      ) IS NOT NULL
      AND EXTRACT(YEAR FROM (
        CASE
          WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
          WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
          WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
          ELSE NULL
        END
      ))::int >= 2026
    )`),r&&o.push(`COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                        WHERE ur.nmdepartamento = a.unidade_hospitalar 
                        LIMIT 1),'') = '${r.replace(/'/g,"''")}'`);let d=o.length>0?`WHERE ${o.join(" AND ")}`:"",E=`
      SELECT COUNT(DISTINCT a.cpf) as total
      FROM stg_alterdata_v2 a
      ${d}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    `,n=await T.prisma.$queryRawUnsafe(E),N=parseInt(n[0]?.total||"0",10),R={"01":N,"02":N,"03":N,"04":N,"05":N,"06":N,"07":N,"08":N,"09":N,10:N,11:N,12:N},m={"01":0,"02":0,"03":0,"04":0,"05":0,"06":0,"07":0,"08":0,"09":0,10:0,11:0,12:0},l=`
      SELECT 
        EXTRACT(MONTH FROM os.data_entrega)::int as mes,
        COUNT(*) as total
      FROM ordem_servico os
      INNER JOIN stg_alterdata_v2 a ON a.cpf = os.colaborador_cpf
      WHERE os.entregue = true
        AND EXTRACT(YEAR FROM os.data_entrega) = ${s}
        AND (
          a.demissao IS NULL
          OR a.demissao = ''
          OR TRIM(a.demissao) = ''
          OR (
            CASE
              WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
              WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
              WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
              ELSE NULL
            END
          ) IS NOT NULL
          AND EXTRACT(YEAR FROM (
            CASE
              WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
              WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
              WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
              ELSE NULL
            END
          ))::int >= 2026
        )
        ${r?`AND COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                        WHERE ur.nmdepartamento = a.unidade_hospitalar 
                        LIMIT 1),'') = '${r.replace(/'/g,"''")}'`:""}
      GROUP BY EXTRACT(MONTH FROM os.data_entrega)
      ORDER BY mes
    `;(await T.prisma.$queryRawUnsafe(l)).forEach(e=>{let a=String(e.mes).padStart(2,"0");void 0!==m[a]&&(m[a]=parseInt(e.total||"0",10))});let p={"01":0,"02":0,"03":0,"04":0,"05":0,"06":0,"07":0,"08":0,"09":0,10:0,11:0,12:0},u=0;for(let e=1;e<=12;e++){let a=String(e).padStart(2,"0");u+=m[a]||0,p[a]=u}let I=u;return i.NextResponse.json({ok:!0,meta:R,metaMensal:R,real:m,realAcumulado:p,totalColaboradores:N,totalMeta:N,totalReal:I,ano:s})}catch(e){return console.error("[ordem-servico/meta-real] error",e),i.NextResponse.json({ok:!1,error:String(e?.message||e)},{status:500})}}let n=new s.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/ordem-servico/meta-real/route",pathname:"/api/ordem-servico/meta-real",filename:"route",bundlePath:"app/api/ordem-servico/meta-real/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/ordem-servico/meta-real/route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:N,staticGenerationAsyncStorage:R,serverHooks:m}=n,l="/api/ordem-servico/meta-real/route";function p(){return(0,d.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:R})}},65892:(e,a,r)=>{r.d(a,{prisma:()=>s});var t=r(53524);let s=globalThis.prisma??new t.PrismaClient({log:["error","warn"]})},87916:(e,a,r)=>{e.exports=r(30517)}};var a=require("../../../../webpack-runtime.js");a.C(e);var r=e=>a(a.s=e),t=a.X(0,[2035,4389],()=>r(26495));module.exports=t})();