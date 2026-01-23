'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { formatThousands as _formatThousands } from '@/components/utils/Utils'
import DoughnutChart from '@/components/charts/DoughnutChart'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler } from 'chart.js'
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler)

type KPI = {
  metaMensal: { valorMeta: number, realizado: number },
  variacaoMensalPerc: number,
  metaAnual: { valorMeta: number, realizado: number },
  colaboradoresAtendidos: number,
  itensEntregues: number,
  pendenciasAbertas: number,
  topItens: { itemId: string, nome: string, quantidade: number }[]
}

type Series = {
  labels: string[],
  entregas: number[],
  itens: number[]
}

type Alertas = {
  estoqueAbaixoMinimo: { unidade: string, item: string, quantidade: number, minimo: number }[],
  pendenciasVencidas: number
}

type Payload = {
  kpis: KPI,
  series: Series,
  alertas: Alertas
}

const formatThousands = (v:number) => _formatThousands ? _formatThousands(v) : (v ?? 0).toLocaleString('pt-BR')

export default function DashboardEPI(){
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regionais, setRegionais] = useState<string[]>([])
  const [regionalSelecionada, setRegionalSelecionada] = useState<string>('')

  // Carrega regionais disponíveis
  useEffect(() => {
    fetch('/api/entregas/options', { cache: 'force-cache' })
      .then(r => r.json())
      .then(json => {
        const regs = (json.regionais || []).sort()
        setRegionais(regs)
        if (regs.length > 0 && !regionalSelecionada) {
          setRegionalSelecionada('') // '' = todas (consolidado)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let mounted = true
    async function fetchData(){
      try{
        setLoading(true)
        const url = regionalSelecionada 
          ? `/api/dashboard/metrics?regional=${encodeURIComponent(regionalSelecionada)}`
          : '/api/dashboard/metrics'
        const res = await fetch(url, { cache: 'no-store' })
        if(!res.ok) throw new Error('Falha ao buscar métricas')
        const json = await res.json()
        if(mounted) setData(json)
      }catch(e:any){
        if(mounted) setError(e.message || 'Erro inesperado')
      }finally{
        if(mounted) setLoading(false)
      }
    }
    fetchData()
    return () => { mounted = false }
  }, [regionalSelecionada])

  const mensPct = useMemo(() => {
    if(!data) return 0
    const meta = data.kpis.metaMensal
    if(!meta.valorMeta) return 0
    return Math.max(0, Math.min(100, (meta.realizado / meta.valorMeta) * 100))
  }, [data])

  const anualPct = useMemo(() => {
    if(!data) return 0
    const meta = data.kpis.metaAnual
    if(!meta.valorMeta) return 0
    return Math.max(0, Math.min(100, (meta.realizado / meta.valorMeta) * 100))
  }, [data])

  const lineChartData = useMemo(() => {
    if(!data) return { labels: [], datasets: [] }
    return {
      labels: data.series.labels,
      datasets: [
        {
          label: 'Planejado',
          data: data.series.itens,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
        },
        {
          label: 'Realizado',
          data: data.series.entregas,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
        }
      ]
    }
  }, [data])

  if(loading){
    return (
      <div className="space-y-6">
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({length:4}).map((_,i)=>(
            <div key={i} className="h-32 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
        <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-80 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
    )
  }

  if(error){
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
        Erro ao carregar Dashboard: {error}
      </div>
    )
  }

  if(!data){
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        Sem dados para exibir.
      </div>
    )
  }

  const variacaoCor = data.kpis.variacaoMensalPerc >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
  const variacaoIcon = data.kpis.variacaoMensalPerc >= 0 ? '↑' : '↓'

  return (
    <div className="space-y-6">
      {/* Cabeçalho com filtro */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            EPI • Dashboard
          </p>
          <h1 className="mt-1 text-lg font-semibold">
            Dashboard de Entregas de EPI
          </h1>
          <p className="mt-1 text-xs text-muted">
            {regionalSelecionada 
              ? `Visão consolidada da Regional: ${regionalSelecionada}`
              : 'Visão consolidada geral de todas as regionais'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-muted">Filtrar por Regional:</label>
          <select
            value={regionalSelecionada}
            onChange={(e) => setRegionalSelecionada(e.target.value)}
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[200px]"
          >
            <option value="">Todas as Regionais (Consolidado)</option>
            {regionais.map((reg) => (
              <option key={reg} value={reg}>{reg}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards de KPIs principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Meta Mensal */}
        <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-muted uppercase tracking-wide">
              Meta Mensal
            </div>
            <div className={`text-xs font-semibold ${variacaoCor}`}>
              {variacaoIcon} {Math.abs(data.kpis.variacaoMensalPerc).toFixed(1)}%
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <DoughnutChart
                data={{
                  labels: ['Realizado', 'Restante'],
                  datasets: [{ 
                    data: [mensPct, 100 - mensPct], 
                    borderWidth: 0,
                    backgroundColor: ['rgb(34, 197, 94)', 'rgb(229, 231, 235)']
                  }]
                }}
                width={80}
                height={80}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-2xl font-bold text-text">{mensPct.toFixed(1)}%</div>
              <div className="text-xs text-muted mt-1">
                {formatThousands(data.kpis.metaMensal.realizado)} / {formatThousands(data.kpis.metaMensal.valorMeta)}
              </div>
            </div>
          </div>
        </div>

        {/* Meta Anual */}
        <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
          <div className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
            Meta Anual
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <DoughnutChart
                data={{
                  labels: ['Realizado', 'Restante'],
                  datasets: [{ 
                    data: [anualPct, 100 - anualPct], 
                    borderWidth: 0,
                    backgroundColor: ['rgb(59, 130, 246)', 'rgb(229, 231, 235)']
                  }]
                }}
                width={80}
                height={80}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-2xl font-bold text-text">{anualPct.toFixed(1)}%</div>
              <div className="text-xs text-muted mt-1">
                {formatThousands(data.kpis.metaAnual.realizado)} / {formatThousands(data.kpis.metaAnual.valorMeta)}
              </div>
            </div>
          </div>
        </div>

        {/* Colaboradores Atendidos */}
        <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
          <div className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
            Colaboradores Atendidos
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-text">
              {formatThousands(data.kpis.colaboradoresAtendidos)}
            </div>
            <div className="text-xs text-muted">
              No mês atual
            </div>
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted">Itens entregues:</div>
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatThousands(data.kpis.itensEntregues)}
              </div>
            </div>
          </div>
        </div>

        {/* Pendências */}
        <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
          <div className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
            Pendências
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-text">
              {formatThousands(data.kpis.pendenciasAbertas)}
            </div>
            <div className="text-xs text-muted">
              Pendências abertas
            </div>
            {data.alertas.pendenciasVencidas > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {formatThousands(data.alertas.pendenciasVencidas)} vencidas
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráficos principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de evolução */}
        <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-text">Evolução: Planejado vs Realizado</h3>
            <p className="text-xs text-muted mt-1">
              Últimos 6 meses - EPIs obrigatórios
            </p>
          </div>
          <Line 
            data={lineChartData} 
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { 
                legend: { 
                  display: true,
                  position: 'top',
                  labels: {
                    usePointStyle: true,
                    padding: 15,
                    font: { size: 12 }
                  }
                }, 
                tooltip: { 
                  callbacks: { 
                    label(ctx: any){ 
                      return `${ctx.dataset.label}: ${formatThousands(Number(ctx.parsed.y||0))}` 
                    } 
                  } 
                } 
              },
              scales: { 
                y: { 
                  beginAtZero: true,
                  ticks: { 
                    callback: (v: any) => formatThousands(Number(v)),
                    font: { size: 11 }
                  },
                  grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                  }
                },
                x: {
                  grid: {
                    display: false
                  },
                  ticks: {
                    font: { size: 11 }
                  }
                }
              }
            }} 
            height={280}
          />
        </div>

        {/* Top Itens */}
        <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-text">Top 5 EPIs Mais Entregues</h3>
            <p className="text-xs text-muted mt-1">
              No mês atual - EPIs obrigatórios
            </p>
          </div>
          <div className="space-y-3">
            {data.kpis.topItens?.length ? (
              data.kpis.topItens.map((it, idx) => {
                const maxQty = Math.max(...data.kpis.topItens.map(i => i.quantidade), 1)
                const porcentagem = (it.quantidade / maxQty) * 100
                return (
                  <div key={it.itemId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-text truncate flex-1 mr-2">
                        {idx + 1}. {it.nome}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                        {formatThousands(it.quantidade)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${porcentagem}%` }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-sm text-muted text-center py-8">
                Sem consumo no mês atual.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alertas e Informações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estoque abaixo do mínimo */}
        <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text">Alertas de Estoque</h3>
              <p className="text-xs text-muted mt-1">
                Itens abaixo do estoque mínimo
              </p>
            </div>
            {data.alertas.estoqueAbaixoMinimo?.length > 0 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {data.alertas.estoqueAbaixoMinimo.length}
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.alertas.estoqueAbaixoMinimo?.length ? (
              data.alertas.estoqueAbaixoMinimo.map((e, idx) => (
                <div 
                  key={idx} 
                  className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-red-800 dark:text-red-200 truncate">
                        {e.unidade}
                      </div>
                      <div className="text-xs text-red-700 dark:text-red-300 mt-0.5 truncate">
                        {e.item}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs font-bold text-red-600 dark:text-red-400">
                        {formatThousands(e.quantidade)}
                      </div>
                      <div className="text-[10px] text-red-500 dark:text-red-400">
                        min: {formatThousands(e.minimo)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-900/50 dark:bg-emerald-900/20">
                <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  ✓ Nenhum item abaixo do estoque mínimo
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resumo e informações */}
        <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-text">Informações do Período</h3>
            <p className="text-xs text-muted mt-1">
              Dados consolidados do mês atual
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-xs text-muted">Período analisado</span>
              <span className="text-xs font-semibold text-text">
                {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-xs text-muted">Variação mensal</span>
              <span className={`text-xs font-semibold ${variacaoCor}`}>
                {variacaoIcon} {Math.abs(data.kpis.variacaoMensalPerc).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-xs text-muted">Taxa de entrega</span>
              <span className="text-xs font-semibold text-text">
                {mensPct.toFixed(1)}%
              </span>
            </div>
            <div className="pt-2">
              <div className="text-xs text-muted mb-2">Observações:</div>
              <ul className="text-xs text-muted space-y-1 list-disc list-inside">
                <li>Apenas EPIs obrigatórios são considerados nas metas</li>
                <li>Dados atualizados em tempo real</li>
                {regionalSelecionada && (
                  <li>Filtro aplicado: Regional {regionalSelecionada}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
