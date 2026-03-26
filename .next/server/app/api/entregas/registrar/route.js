"use strict";(()=>{var e={};e.id=9598,e.ids=[9598,5892],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},73321:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>c,patchFetch:()=>N,requestAsyncStorage:()=>d,routeModule:()=>g,serverHooks:()=>m,staticGenerationAsyncStorage:()=>l});var a={};r.r(a),r.d(a,{POST:()=>p});var n=r(87916),i=r(49930),s=r(2169),o=r(4389),u=r(65892);async function p(e){try{let{cpf:t,nome:r,funcao:a,regional:n,unidade:i,item:s,quantidade:p,year:g,obs:d,user:l}=await e.json()||{};if(!t||!s)return o.NextResponse.json({ok:!1,error:"cpf e item s\xe3o obrigat\xf3rios."},{status:400});await u.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS entrega_epi (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        cpf text NOT NULL,
        nome text NOT NULL,
        funcao text,
        regional text,
        unidade text,
        item text NOT NULL,
        quantidade int NOT NULL,
        data_entrega timestamptz NOT NULL DEFAULT now(),
        entregue_por text,
        obs text
      );
    `),await u.prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_entrega_unique
      ON entrega_epi (cpf, item, date_part('year', data_entrega));
    `);let m=`
      INSERT INTO entrega_epi (cpf, nome, funcao, regional, unidade, item, quantidade, data_entrega, entregue_por, obs)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
      ON CONFLICT (cpf, item, date_part('year', data_entrega)) DO UPDATE
        SET quantidade = EXCLUDED.quantidade,
            data_entrega = NOW(),
            entregue_por = EXCLUDED.entregue_por,
            obs = EXCLUDED.obs
      RETURNING id
    `,c=await u.prisma.$queryRawUnsafe(m,String(t),String(r||""),String(a||null),String(n||null),String(i||null),String(s),parseInt(String(p||1),10),String(l||"sistema"),String(d||null));return o.NextResponse.json({ok:!0,id:c?.[0]?.id||null})}catch(e){return o.NextResponse.json({ok:!1,error:String(e?.message||e)},{status:500})}}let g=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/entregas/registrar/route",pathname:"/api/entregas/registrar",filename:"route",bundlePath:"app/api/entregas/registrar/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/entregas/registrar/route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:d,staticGenerationAsyncStorage:l,serverHooks:m}=g,c="/api/entregas/registrar/route";function N(){return(0,s.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:l})}},65892:(e,t,r)=>{r.d(t,{prisma:()=>n});var a=r(53524);let n=globalThis.prisma??new a.PrismaClient({log:["error","warn"]})},87916:(e,t,r)=>{e.exports=r(30517)}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[2035,4389],()=>r(73321));module.exports=a})();