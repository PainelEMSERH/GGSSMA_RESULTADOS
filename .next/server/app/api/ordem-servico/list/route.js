"use strict";(()=>{var a={};a.id=220,a.ids=[220,5892],a.modules={53524:a=>{a.exports=require("@prisma/client")},20399:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},80295:(a,e,r)=>{r.r(e),r.d(e,{originalPathname:()=>T,patchFetch:()=>c,requestAsyncStorage:()=>S,routeModule:()=>p,serverHooks:()=>l,staticGenerationAsyncStorage:()=>R});var s={};r.r(s),r.d(s,{GET:()=>d});var t=r(87916),o=r(49930),E=r(2169),i=r(4389),n=r(65892);async function d(a){try{await n.prisma.$executeRawUnsafe(`
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
    `),await n.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_colaborador_cpf ON ordem_servico(colaborador_cpf);
    `),await n.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_data_entrega ON ordem_servico(data_entrega);
    `);let e=new URL(a.url),r=(e.searchParams.get("regional")||"").trim(),s=(e.searchParams.get("unidade")||"").trim(),t=e.searchParams.get("entregue")||"",o=(e.searchParams.get("search")||"").trim(),E=Math.max(1,parseInt(e.searchParams.get("page")||"1",10)),d=Math.min(200,Math.max(10,parseInt(e.searchParams.get("pageSize")||"25",10))),p=e.searchParams.get("sortBy")||"nome",S=e.searchParams.get("sortDir")||"asc",R=(E-1)*d,l=await n.prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_alterdata_v2'
      ) AS exists
    `);if(!l?.[0]?.exists)return i.NextResponse.json({ok:!0,rows:[],total:0});let T=await n.prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `),c=T?.[0]?.exists,m=[];if(m.push(`(
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
    )`),r&&c){let a=r.replace(/'/g,"''");m.push(`(UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${a}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
        SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${a}'))
      ))`)}if(s){let a=s.replace(/'/g,"''");c?m.push(`(UPPER(TRIM(COALESCE(u.nmdepartamento, ''))) = UPPER(TRIM('${a}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${a}')) OR UPPER(TRIM(COALESCE(u.nmdepartamento, ''))) LIKE UPPER(TRIM('%${a}%')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER(TRIM('%${a}%')))`):m.push(`(UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${a}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER(TRIM('%${a}%')))`)}if(o){let a=o.replace(/'/g,"''");m.push(`(
        a.colaborador ILIKE '%${a}%' OR
        a.cpf ILIKE '%${a}%' OR
        a.matricula ILIKE '%${a}%'
      )`)}let u=m.length?`WHERE ${m.join(" AND ")}`:"",A="nome"===p?"sub.nome":"unidade"===p?"sub.unidade":"regional"===p?"sub.regional":"dataAdmissao"===p?'sub."dataAdmissao"':"sub.nome",O=c?`
      SELECT sub.* FROM (
        SELECT DISTINCT ON (a.cpf)
          COALESCE(a.cpf, '') AS cpf,
          COALESCE(a.colaborador, '') AS nome,
          COALESCE(a.matricula, '') AS matricula,
          COALESCE(NULLIF(TRIM(u.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') AS unidade,
          COALESCE(NULLIF(TRIM(u.regional_responsavel), ''), '') AS regional,
          COALESCE(a.funcao, '') AS funcao,
          CASE 
            WHEN a.admissao IS NULL OR a.admissao = '' OR TRIM(a.admissao) = '' THEN NULL
            ELSE a.admissao::text
          END AS "dataAdmissao",
          COALESCE(os.entregue, false) AS "osEntregue",
          os.data_entrega::text AS "dataEntregaOS",
          os.responsavel AS "responsavelEntrega"
        FROM stg_alterdata_v2 a
        LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
        LEFT JOIN ordem_servico os ON os.colaborador_cpf = a.cpf
        ${u}
        AND COALESCE(a.cpf, '') != ''
        AND COALESCE(a.funcao, '') != ''
        ORDER BY a.cpf, a.colaborador
      ) sub
      ORDER BY ${A} ${S.toUpperCase()}
      LIMIT ${d} OFFSET ${R}
    `:`
      SELECT sub.* FROM (
        SELECT DISTINCT ON (a.cpf)
          COALESCE(a.cpf, '') AS cpf,
          COALESCE(a.colaborador, '') AS nome,
          COALESCE(a.matricula, '') AS matricula,
          COALESCE(a.unidade_hospitalar, '') AS unidade,
          '' AS regional,
          COALESCE(a.funcao, '') AS funcao,
          CASE 
            WHEN a.admissao IS NULL OR a.admissao = '' OR TRIM(a.admissao) = '' THEN NULL
            ELSE a.admissao::text
          END AS "dataAdmissao",
          COALESCE(os.entregue, false) AS "osEntregue",
          os.data_entrega::text AS "dataEntregaOS",
          os.responsavel AS "responsavelEntrega"
        FROM stg_alterdata_v2 a
        LEFT JOIN ordem_servico os ON os.colaborador_cpf = a.cpf
        ${u}
        AND COALESCE(a.cpf, '') != ''
        AND COALESCE(a.funcao, '') != ''
        ORDER BY a.cpf, a.colaborador
      ) sub
      ORDER BY ${A} ${S.toUpperCase()}
      LIMIT ${d} OFFSET ${R}
    `,L=c?`
      SELECT COUNT(DISTINCT a.cpf)::int AS total
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      ${u}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    `:`
      SELECT COUNT(DISTINCT a.cpf)::int AS total
      FROM stg_alterdata_v2 a
      ${u}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    `,[g,I]=await Promise.all([n.prisma.$queryRawUnsafe(O),n.prisma.$queryRawUnsafe(L)]),C=Array.isArray(g)?g:[],N=Number(I?.[0]?.total??0),_=C;"sim"===t?_=C.filter(a=>!0===a.osEntregue):"nao"===t&&(_=C.filter(a=>!a.osEntregue));let M=_.map(a=>({id:String(a.cpf||""),nome:String(a.nome||""),cpf:String(a.cpf||""),matricula:String(a.matricula||""),unidade:String(a.unidade||""),regional:String(a.regional||""),funcao:String(a.funcao||""),dataAdmissao:a.dataAdmissao?String(a.dataAdmissao):null,osEntregue:!!a.osEntregue,dataEntregaOS:a.dataEntregaOS?String(a.dataEntregaOS):null,responsavelEntrega:a.responsavelEntrega?String(a.responsavelEntrega):null}));return i.NextResponse.json({ok:!0,rows:M,total:t?_.length:N})}catch(a){return console.error("[ordem-servico/list] error",a),i.NextResponse.json({ok:!1,error:String(a?.message||a)},{status:500})}}let p=new t.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/ordem-servico/list/route",pathname:"/api/ordem-servico/list",filename:"route",bundlePath:"app/api/ordem-servico/list/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/ordem-servico/list/route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:S,staticGenerationAsyncStorage:R,serverHooks:l}=p,T="/api/ordem-servico/list/route";function c(){return(0,E.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:R})}},65892:(a,e,r)=>{r.d(e,{prisma:()=>t});var s=r(53524);let t=globalThis.prisma??new s.PrismaClient({log:["error","warn"]})},87916:(a,e,r)=>{a.exports=r(30517)}};var e=require("../../../../webpack-runtime.js");e.C(a);var r=a=>e(e.s=a),s=e.X(0,[2035,4389],()=>r(80295));module.exports=s})();