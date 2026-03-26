"use strict";(()=>{var a={};a.id=2504,a.ids=[2504],a.modules={53524:a=>{a.exports=require("@prisma/client")},20399:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},49353:(a,e,t)=>{t.r(e),t.d(e,{originalPathname:()=>L,patchFetch:()=>O,requestAsyncStorage:()=>E,routeModule:()=>c,serverHooks:()=>m,staticGenerationAsyncStorage:()=>p});var r={};t.r(r),t.d(r,{GET:()=>l,dynamic:()=>d,revalidate:()=>u,runtime:()=>i});var s=t(87916),o=t(49930),n=t(2169);let i="nodejs",d="force-dynamic",u=0;async function l(a){let{prisma:e}=await t.e(5892).then(t.bind(t,65892)),r=new URL(a.url),s=r.searchParams.get("q")?.trim()||"",o=r.searchParams.get("regionalId")||"",n=r.searchParams.get("unidadeId")||"",i=r.searchParams.get("status")||"",d=Math.max(1,parseInt(r.searchParams.get("page")||"1")),u=Math.min(100,Math.max(10,parseInt(r.searchParams.get("size")||"20"))),l=(d-1)*u;try{let a=!1;try{let t=await e.$queryRaw`SELECT COUNT(*)::int AS c FROM colaborador`;a=Number(t?.[0]?.c||0)>0}catch{a=!1}if(a){let a=[],t=[];s&&(a.push(`(c.nome ILIKE '%'||$${t.length+1}||'%' OR c.matricula ILIKE '%'||$${t.length+1}||'%')`),t.push(s)),i&&(a.push(`c.status = $${t.length+1}`),t.push(i)),n&&(a.push(`c.unidadeId = $${t.length+1}`),t.push(n)),o&&(a.push(`u.regionalId = $${t.length+1}`),t.push(o));let r=a.length?`WHERE ${a.join(" AND ")}`:"",c=`
        FROM colaborador c
        JOIN funcao f   ON f.id = c.funcaoId
        JOIN unidade u  ON u.id = c.unidadeId
        JOIN regional r ON r.id = u.regionalId
        ${r}
      `,E=await e.$queryRawUnsafe(`
        SELECT c.id, c.nome, c.matricula, c.email, c.telefone, c.status,
               f.id as "funcaoId", f.nome as funcao,
               u.id as "unidadeId", u.nome as unidade,
               r.id as "regionalId", r.nome as regional
        ${c}
        ORDER BY c.nome
        LIMIT ${u} OFFSET ${l}
      `,...t),p=await e.$queryRawUnsafe(`SELECT COUNT(*)::int as c ${c}`,...t),m=Number(p?.[0]?.c||0);return Response.json({ok:!0,page:d,size:u,total:m,rows:E})}let t=a=>a.replace(/'/g,"''"),r=[];if(s){let a=`%${t(s)}%`;r.push(`(a.colaborador ILIKE '${a}' OR a.cpf ILIKE '${a}')`)}"ativo"===i&&r.push("(a.demissao IS NULL OR a.demissao > NOW()::date)"),"inativo"===i&&r.push("(a.demissao IS NOT NULL AND a.demissao <= NOW()::date)"),n&&r.push(`md5(COALESCE(a.unidade_hospitalar,'')) = '${t(n)}'`),o&&r.push(`md5(COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                             WHERE /* tentar ambas as possibilidades de nome */ 
                                   COALESCE(ur.nmddepartamento, ur.nmd_departamento) = a.unidade_hospitalar 
                             LIMIT 1),'')) = '${t(o)}'`);let c=r.length?`WHERE ${r.join(" AND ")}`:"",E=`
      SELECT 
        a.cpf as id,
        a.colaborador as nome,
        a.cpf as matricula,
        NULL::text as email,
        NULL::text as telefone,
        CASE WHEN a.demissao IS NULL OR a.demissao > NOW()::date THEN 'ativo' ELSE 'inativo' END as status,
        md5(COALESCE(a.funcao,'')) as "funcaoId",
        COALESCE(a.funcao,'') as funcao,
        md5(COALESCE(a.unidade_hospitalar,'')) as "unidadeId",
        COALESCE(a.unidade_hospitalar,'') as unidade,
        md5(COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                      WHERE COALESCE(ur.nmddepartamento, ur.nmd_departamento) = a.unidade_hospitalar 
                      LIMIT 1),'')) as "regionalId",
        COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                  WHERE COALESCE(ur.nmddepartamento, ur.nmd_departamento) = a.unidade_hospitalar 
                  LIMIT 1),'') as regional
      FROM stg_alterdata a
      ${c}
      ORDER BY a.colaborador
      LIMIT ${u} OFFSET ${l}
    `;try{let a=await e.$queryRawUnsafe(E),t=await e.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM stg_alterdata a ${c}`),r=Number(t?.[0]?.c||0);return Response.json({ok:!0,page:d,size:u,total:r,rows:a})}catch(i){let a=r.filter(a=>!a.includes("regional_responsavel")),t=a.length?`WHERE ${a.join(" AND ")}`:"",s=await e.$queryRawUnsafe(`
        SELECT 
          a.cpf as id,
          a.colaborador as nome,
          a.cpf as matricula,
          NULL::text as email,
          NULL::text as telefone,
          CASE WHEN a.demissao IS NULL OR a.demissao > NOW()::date THEN 'ativo' ELSE 'inativo' END as status,
          md5(COALESCE(a.funcao,'')) as "funcaoId",
          COALESCE(a.funcao,'') as funcao,
          md5(COALESCE(a.unidade_hospitalar,'')) as "unidadeId",
          COALESCE(a.unidade_hospitalar,'') as unidade,
          NULL::text as "regionalId",
          NULL::text as regional
        FROM stg_alterdata a
        ${t}
        ORDER BY a.colaborador
        LIMIT ${u} OFFSET ${l}
      `),o=await e.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM stg_alterdata a ${t}`),n=Number(o?.[0]?.c||0);return Response.json({ok:!0,page:d,size:u,total:n,rows:s})}}catch(a){return console.error("[colaboradores/list] error",a),Response.json({ok:!1,error:String(a?.message||a)},{status:200})}}let c=new s.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/colaboradores/list/route",pathname:"/api/colaboradores/list",filename:"route",bundlePath:"app/api/colaboradores/list/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/colaboradores/list/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:E,staticGenerationAsyncStorage:p,serverHooks:m}=c,L="/api/colaboradores/list/route";function O(){return(0,n.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:p})}},87916:(a,e,t)=>{a.exports=t(30517)}};var e=require("../../../../webpack-runtime.js");e.C(a);var t=a=>e(e.s=a),r=e.X(0,[2035],()=>t(49353));module.exports=r})();