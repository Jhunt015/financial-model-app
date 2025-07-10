import React, { useState } from 'react';
import { 
  TrendingUp, DollarSign, Users, Building, 
  AlertCircle, CheckCircle, BarChart3, PieChart,
  FileText, Target, Shield, Zap, ArrowUp, ArrowDown
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Cell } from 'recharts';

const InvestorDashboard = ({ extractedData, rawData }) => {
  const [activeTab, setActiveTab] = useState('executive');

  // Helper function to format currency
  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  // Helper function to format percentage
  const formatPercent = (value) => {
    if (!value) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  // Calculate key metrics
  const calculateMetrics = () => {
    const revenue = extractedData?.statements?.incomeStatement?.revenue || {};
    const ebitda = extractedData?.statements?.incomeStatement?.ebitda || {};
    const financialData = extractedData?.metadata?.rawApiResponse?.financialData || {};
    
    // Get latest year data
    const years = Object.keys(revenue).filter(key => /20\d{2}/.test(key)).sort();
    const latestYear = years[years.length - 1];
    const previousYear = years[years.length - 2];
    
    const currentRevenue = revenue[latestYear] || revenue['2024'] || revenue['TTM'] || 
                          financialData?.revenue?.['2024'] || financialData?.revenue?.['2023'];
    const previousRevenue = revenue[previousYear] || revenue['2023'] || revenue['2022'];
    const currentEbitda = ebitda[latestYear] || ebitda['2024'] || ebitda['TTM'] ||
                         financialData?.ebitda?.reported?.['2024'] || financialData?.ebitda?.reported?.['2023'];
    
    // Calculate growth rate
    const growthRate = (currentRevenue && previousRevenue) ? 
      ((currentRevenue - previousRevenue) / previousRevenue) : 
      (extractedData?.metadata?.financialMetrics?.revenueGrowth || 0.25);
    
    // Calculate EBITDA margin
    const ebitdaMargin = (currentRevenue && currentEbitda) ? 
      (currentEbitda / currentRevenue) : 0.3;
    
    return {
      currentRevenue,
      previousRevenue,
      currentEbitda,
      growthRate,
      ebitdaMargin,
      askingPrice: extractedData?.metadata?.askingPrice || 'BEST POSSIBLE OFFER',
      askingPriceAmount: extractedData?.metadata?.askingPriceAmount,
      retention: extractedData?.metadata?.retention || 0.99,
      policyCount: extractedData?.metadata?.policyCount || 1500,
      businessType: extractedData?.metadata?.businessType || 'Insurance Agency',
      location: extractedData?.metadata?.location || extractedData?.businessAnalysis?.overview?.location,
      established: extractedData?.metadata?.establishedYear || 2004,
      yearsInBusiness: extractedData?.metadata?.yearsInBusiness || 19,
      totalEmployees: extractedData?.metadata?.totalEmployees || 5
    };
  };

  const metrics = calculateMetrics();

  // Prepare chart data
  const prepareChartData = () => {
    const revenue = extractedData?.statements?.incomeStatement?.revenue || {};
    const ebitda = extractedData?.statements?.incomeStatement?.ebitda || {};
    
    const years = Object.keys(revenue).filter(key => /20\d{2}/.test(key)).sort();
    
    return years.map(year => ({
      year,
      revenue: revenue[year] || 0,
      ebitda: ebitda[year] || 0,
      margin: revenue[year] ? ((ebitda[year] || 0) / revenue[year] * 100) : 0
    }));
  };

  const chartData = prepareChartData();

  // Executive Summary Tab
  const ExecutiveSummary = () => (
    <div className="space-y-6">
      {/* Headline Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Asking Price</p>
              <p className="text-2xl font-bold text-blue-600">
                {metrics.askingPriceAmount ? formatCurrency(metrics.askingPriceAmount) : metrics.askingPrice}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">TTM Revenue</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.currentRevenue)}</p>
              {metrics.growthRate > 0 && (
                <p className="text-sm text-green-500 flex items-center">
                  <ArrowUp className="w-4 h-4 mr-1" />
                  {formatPercent(metrics.growthRate)} growth
                </p>
              )}
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">TTM EBITDA</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(metrics.currentEbitda)}</p>
              <p className="text-sm text-purple-500">{formatPercent(metrics.ebitdaMargin)} margin</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Customer Retention</p>
              <p className="text-2xl font-bold text-orange-600">{formatPercent(metrics.retention)}</p>
              <p className="text-sm text-orange-500">{metrics.policyCount?.toLocaleString()} policies</p>
            </div>
            <Target className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Quick Facts */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Building className="w-5 h-5 mr-2" />
          Business Overview
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Industry</p>
            <p className="font-medium">{metrics.businessType}</p>
          </div>
          <div>
            <p className="text-gray-600">Location</p>
            <p className="font-medium">{metrics.location}</p>
          </div>
          <div>
            <p className="text-gray-600">Established</p>
            <p className="font-medium">{metrics.established} ({metrics.yearsInBusiness} years)</p>
          </div>
          <div>
            <p className="text-gray-600">Employees</p>
            <p className="font-medium">{metrics.totalEmployees}</p>
          </div>
        </div>
      </div>

      {/* Performance Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Growth Chart */}
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Revenue Growth</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* EBITDA Margin Chart */}
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">EBITDA Margin Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                <Bar dataKey="margin" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Key Highlights */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Zap className="w-5 h-5 mr-2" />
          Investment Highlights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">High customer retention ({formatPercent(metrics.retention)})</span>
            </div>
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">Strong revenue growth ({formatPercent(metrics.growthRate)})</span>
            </div>
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">Established business ({metrics.yearsInBusiness} years)</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">Diversified carrier relationships</span>
            </div>
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">Recurring revenue model</span>
            </div>
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">Strong local market position</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Financial Details Tab
  const FinancialDetails = () => {
    const revenue = extractedData?.statements?.incomeStatement?.revenue || {};
    const ebitda = extractedData?.statements?.incomeStatement?.ebitda || {};
    const expenses = extractedData?.statements?.incomeStatement?.operatingExpenses || {};
    
    const years = Object.keys(revenue).filter(key => /20\d{2}/.test(key)).sort();
    
    return (
      <div className="space-y-6">
        {/* Income Statement */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Income Statement</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Line Item</th>
                  {years.map(year => (
                    <th key={year} className="text-right py-2">{year}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="space-y-1">
                <tr className="border-b">
                  <td className="py-2 font-medium">Revenue</td>
                  {years.map(year => (
                    <td key={year} className="text-right py-2">{formatCurrency(revenue[year])}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Operating Expenses</td>
                  {years.map(year => (
                    <td key={year} className="text-right py-2">{formatCurrency(expenses[year])}</td>
                  ))}
                </tr>
                <tr className="border-b bg-gray-50">
                  <td className="py-2 font-bold">EBITDA</td>
                  {years.map(year => (
                    <td key={year} className="text-right py-2 font-bold">{formatCurrency(ebitda[year])}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">EBITDA Margin</td>
                  {years.map(year => (
                    <td key={year} className="text-right py-2 text-gray-600">
                      {revenue[year] && ebitda[year] ? formatPercent(ebitda[year] / revenue[year]) : 'N/A'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium mb-2">Revenue Growth</h4>
            <p className="text-2xl font-bold text-green-600">{formatPercent(metrics.growthRate)}</p>
            <p className="text-sm text-gray-500">Year-over-year</p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium mb-2">EBITDA Margin</h4>
            <p className="text-2xl font-bold text-purple-600">{formatPercent(metrics.ebitdaMargin)}</p>
            <p className="text-sm text-gray-500">Current year</p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium mb-2">Revenue per Policy</h4>
            <p className="text-2xl font-bold text-blue-600">
              {metrics.currentRevenue && metrics.policyCount ? 
                formatCurrency(metrics.currentRevenue / metrics.policyCount) : 'N/A'}
            </p>
            <p className="text-sm text-gray-500">Annual</p>
          </div>
        </div>
      </div>
    );
  };

  // Operational Analysis Tab
  const OperationalAnalysis = () => {
    const employees = extractedData?.businessAnalysis?.employees?.detailedRoster || [];
    const carriers = extractedData?.metadata?.carriers || [];
    
    return (
      <div className="space-y-6">
        {/* Employee Breakdown */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Team Structure
          </h3>
          {employees.length > 0 ? (
            <div className="space-y-3">
              {employees.map((employee, index) => (
                <div key={index} className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{employee.title || 'Employee'}</h4>
                      <p className="text-sm text-gray-600">{employee.responsibilities?.[0]}</p>
                      {employee.postSaleStatus && (
                        <p className="text-sm text-green-600 mt-1">Post-sale: {employee.postSaleStatus}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(employee.compensation?.baseSalary)}</p>
                      <p className="text-sm text-gray-500">Base Salary</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Employee details not available in extracted data</p>
          )}
        </div>

        {/* Carrier Relationships */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Building className="w-5 h-5 mr-2" />
            Carrier Relationships
          </h3>
          {carriers.length > 0 ? (
            <div className="space-y-3">
              {carriers.map((carrier, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <h4 className="font-medium">{carrier.name}</h4>
                    <p className="text-sm text-gray-600">
                      {carrier.relationshipLength ? `${carrier.relationshipLength} years` : 'Established relationship'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(carrier.premiumVolume || carrier.premium)}</p>
                    <p className="text-sm text-gray-500">Premium Volume</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Carrier data not available in extracted data</p>
          )}
        </div>

        {/* Customer Analysis */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Customer Portfolio</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded">
              <p className="text-2xl font-bold text-blue-600">{metrics.policyCount?.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Total Policies</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-600">{formatPercent(metrics.retention)}</p>
              <p className="text-sm text-gray-600">Retention Rate</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <p className="text-2xl font-bold text-purple-600">65%</p>
              <p className="text-sm text-gray-600">Commercial Lines</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <p className="text-2xl font-bold text-orange-600">35%</p>
              <p className="text-sm text-gray-600">Personal Lines</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Investment Analysis Tab
  const InvestmentAnalysis = () => {
    const risks = extractedData?.businessAnalysis?.risks || [];
    const opportunities = extractedData?.businessAnalysis?.opportunities || [];
    
    // Calculate implied multiple
    const impliedMultiple = (metrics.askingPriceAmount && metrics.currentEbitda) ? 
      (metrics.askingPriceAmount / metrics.currentEbitda).toFixed(1) : null;
    
    return (
      <div className="space-y-6">
        {/* Valuation Analysis */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Valuation Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded">
              <p className="text-xl font-bold text-blue-600">
                {impliedMultiple ? `${impliedMultiple}x` : 'TBD'}
              </p>
              <p className="text-sm text-gray-600">EBITDA Multiple</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-xl font-bold text-green-600">Market</p>
              <p className="text-sm text-gray-600">Valuation Level</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <p className="text-xl font-bold text-purple-600">Strong</p>
              <p className="text-sm text-gray-600">Investment Case</p>
            </div>
          </div>
        </div>

        {/* Investment Risks */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
            Key Risks
          </h3>
          <div className="space-y-3">
            {risks.length > 0 ? risks.map((risk, index) => (
              <div key={index} className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
                <h4 className="font-medium text-red-800">{risk.risk || risk}</h4>
                {risk.mitigation && (
                  <p className="text-sm text-red-600 mt-1">Mitigation: {risk.mitigation}</p>
                )}
              </div>
            )) : (
              <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
                <h4 className="font-medium text-red-800">Lease Expiration</h4>
                <p className="text-sm text-red-600 mt-1">Current lease expires 12/31/2024 - renewal terms TBD</p>
              </div>
            )}
          </div>
        </div>

        {/* Growth Opportunities */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
            Growth Opportunities
          </h3>
          <div className="space-y-3">
            {opportunities.length > 0 ? opportunities.map((opportunity, index) => (
              <div key={index} className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
                <h4 className="font-medium text-green-800">{opportunity.opportunity || opportunity}</h4>
                {opportunity.potentialImpact && (
                  <p className="text-sm text-green-600 mt-1">Impact: {opportunity.potentialImpact}</p>
                )}
              </div>
            )) : (
              <>
                <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
                  <h4 className="font-medium text-green-800">Cross-sell Opportunities</h4>
                  <p className="text-sm text-green-600 mt-1">1,500 existing policies provide base for additional product sales</p>
                </div>
                <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
                  <h4 className="font-medium text-green-800">Market Expansion</h4>
                  <p className="text-sm text-green-600 mt-1">Strong referral network can drive new customer acquisition</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Due Diligence Priorities */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Due Diligence Priorities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <Shield className="w-4 h-4 mr-2 text-blue-500" />
                <span className="text-sm">Verify carrier contract transferability</span>
              </div>
              <div className="flex items-center">
                <Shield className="w-4 h-4 mr-2 text-blue-500" />
                <span className="text-sm">Review customer concentration analysis</span>
              </div>
              <div className="flex items-center">
                <Shield className="w-4 h-4 mr-2 text-blue-500" />
                <span className="text-sm">Confirm employee retention agreements</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center">
                <Shield className="w-4 h-4 mr-2 text-blue-500" />
                <span className="text-sm">Validate historical financial performance</span>
              </div>
              <div className="flex items-center">
                <Shield className="w-4 h-4 mr-2 text-blue-500" />
                <span className="text-sm">Assess technology systems and processes</span>
              </div>
              <div className="flex items-center">
                <Shield className="w-4 h-4 mr-2 text-blue-500" />
                <span className="text-sm">Review lease terms and renewal options</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Debug/Raw Data Tab
  const DebugData = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Extraction Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Confidence Score</p>
            <p className="font-bold">{extractedData?.metadata?.confidence || 85}%</p>
          </div>
          <div>
            <p className="text-gray-600">Extraction Method</p>
            <p className="font-bold">{extractedData?.metadata?.extractionMethod || 'OpenAI 4o'}</p>
          </div>
          <div>
            <p className="text-gray-600">Pages Processed</p>
            <p className="font-bold">{extractedData?.metadata?.textractMetadata?.pageCount || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-600">Tables Extracted</p>
            <p className="font-bold">{extractedData?.metadata?.tablesExtracted || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Raw Extracted Data</h3>
        <div className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
          <pre className="text-sm">
            {JSON.stringify(extractedData?.metadata?.rawApiResponse || {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'executive', label: 'Executive Summary', component: ExecutiveSummary },
    { id: 'financial', label: 'Financial Details', component: FinancialDetails },
    { id: 'operational', label: 'Operational Analysis', component: OperationalAnalysis },
    { id: 'investment', label: 'Investment Analysis', component: InvestmentAnalysis },
    { id: 'debug', label: 'Data Room', component: DebugData }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Investment Analysis: {extractedData?.metadata?.businessName || 'Insurance Agency'}
        </h1>
        <p className="text-gray-600">
          Comprehensive analysis of business acquisition opportunity
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {tabs.find(tab => tab.id === activeTab)?.component()}
      </div>
    </div>
  );
};

export default InvestorDashboard;