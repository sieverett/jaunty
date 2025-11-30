
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ForecastResponse, User, FunnelData } from '../types';
import { RevenueChart, FunnelChart } from './Charts';
import { getFunnelData, getFunnelDateRange, generateFullReport, generateReportFromData } from '../services/dataService';
import { ArrowLeft, Zap, TrendingUp, TrendingDown, DollarSign, Lock, Save, Download, AlertCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { exportDashboardToPDF } from '../utils/pdf/pdfExportV2';
import type { ForecastMetrics } from '../utils/pdf/types';

interface DashboardProps {
  data: ForecastResponse;
  onReset: () => void;
  onSave: (name: string) => void;
  user: User;
  uploadedFile: File | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onReset, onSave, user, uploadedFile }) => {

  const [activeTab, setActiveTab] = useState<'forecast' | 'insights'>('forecast');
  const [isSaving, setIsSaving] = useState(false);
  const [isTableMinimized, setIsTableMinimized] = useState(true);

  // Funnel-specific state
  const [funnelData, setFunnelData] = useState<FunnelData[]>(data.funnel || []);
  const [funnelStartDate, setFunnelStartDate] = useState<string>('');
  const [funnelEndDate, setFunnelEndDate] = useState<string>('');
  const [funnelDateRange, setFunnelDateRange] = useState<{ minDate: string; maxDate: string } | null>(null);
  const [isFunnelLoading, setIsFunnelLoading] = useState(false);
  const [funnelError, setFunnelError] = useState<string | null>(null);

  // Report-specific state
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Table filtering state
  const [showHistoricData, setShowHistoricData] = useState(false);
  const [chartDateRange, setChartDateRange] = useState<{ startDate: string | null; endDate: string | null }>({
    startDate: null,
    endDate: null
  });

  // Combine historical and forecast data
  // Sort by date to ensure chronological order and identify any gaps
  const simulatedData = useMemo(() => {
    // Defensive guard: ensure data exists and has required arrays
    if (!data || !Array.isArray(data.historical) || !Array.isArray(data.forecast)) {
      return [];
    }

    const combined = [...data.historical, ...data.forecast]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return combined;
  }, [data]);

  // Filter table data based on historic toggle and brush date range
  const filteredTableData = useMemo(() => {
    let filtered = simulatedData;

    // First apply historic data toggle filter (takes precedence)
    if (!showHistoricData) {
      // Only show forecast data
      filtered = filtered.filter(d => d.type === 'forecast');
    }
    // If showHistoricData is true, show all data (no filtering by type)

    // Then apply brush date range filter
    if (chartDateRange.startDate && chartDateRange.endDate) {
      const startDate = new Date(chartDateRange.startDate);
      const endDate = new Date(chartDateRange.endDate);

      filtered = filtered.filter(d => {
        const itemDate = new Date(d.date);
        return itemDate >= startDate && itemDate <= endDate;
      });
    }

    return filtered;
  }, [simulatedData, showHistoricData, chartDateRange]);

  // Calculate all forecast metrics using useMemo to ensure they update when simulatedData changes
  const forecastMetrics = useMemo(() => {
    // Defensive guard: ensure simulatedData exists and is an array
    if (!Array.isArray(simulatedData) || simulatedData.length === 0) {
      return {
        totalForecastRevenue: 0,
        baselineForecastRevenue: 0,
        diff: 0,
        diffPercent: 0,
        forecast1mo: 0,
        forecast3mo: 0,
        forecast6mo: 0,
        compare1mo: 0,
        compare3mo: 0,
        compare6mo: 0,
        avg12mo: 0,
      };
    }

    const totalForecastRevenue = simulatedData
      .filter(d => d && d.type === 'forecast' && typeof d.revenue === 'number')
      .reduce((sum, d) => sum + d.revenue, 0);

    // Defensive guard for baseline calculation
    const baselineForecastRevenue = (data && Array.isArray(data.forecast))
      ? data.forecast.filter(d => d && typeof d.revenue === 'number').reduce((sum, d) => sum + d.revenue, 0)
      : 0;
      
    const diff = totalForecastRevenue - baselineForecastRevenue;
    const diffPercent = baselineForecastRevenue > 0 ? (diff / baselineForecastRevenue) * 100 : 0;

    // Calculate forecasted revenue for different time periods
    // Ensure forecast data is sorted by date (ascending) to get correct chronological order
    const forecastData = simulatedData
      .filter(d => d.type === 'forecast')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const forecast1mo = forecastData.slice(0, 1).reduce((sum, d) => sum + d.revenue, 0);
    const forecast3mo = forecastData.slice(0, 3).reduce((sum, d) => sum + d.revenue, 0);
    const forecast6mo = forecastData.slice(0, 6).reduce((sum, d) => sum + d.revenue, 0);

    // Calculate historical average for comparison (monthly average)
    const historicalAvg = (data && Array.isArray(data.historical) && data.historical.length > 0)
      ? data.historical.filter(d => d && typeof d.revenue === 'number').reduce((a, b) => a + b.revenue, 0) / data.historical.length
      : 0;
    
    // Calculate comparison percentages vs historical average
    // For 1mo: compare single month directly to monthly average
    // For 3mo and 6mo: compare monthly average of the period to historical monthly average
    const compare1mo = historicalAvg > 0 ? ((forecast1mo - historicalAvg) / historicalAvg) * 100 : 0;
    const avg3mo = forecast3mo / 3;
    const avg6mo = forecast6mo / 6;
    const compare3mo = historicalAvg > 0 ? ((avg3mo - historicalAvg) / historicalAvg) * 100 : 0;
    const compare6mo = historicalAvg > 0 ? ((avg6mo - historicalAvg) / historicalAvg) * 100 : 0;
    
    // Calculate monthly average for 12mo (already calculated avg3mo and avg6mo above)
    const avg12mo = totalForecastRevenue / 12;

    return {
      totalForecastRevenue,
      baselineForecastRevenue,
      diff,
      diffPercent,
      forecast1mo,
      forecast3mo,
      forecast6mo,
      compare1mo,
      compare3mo,
      compare6mo,
      avg12mo,
    };
  }, [simulatedData, data.historical, data.forecast]);

  // Destructure for easier access
  const {
    totalForecastRevenue,
    baselineForecastRevenue,
    diff,
    diffPercent,
    forecast1mo,
    forecast3mo,
    forecast6mo,
    compare1mo,
    compare3mo,
    compare6mo,
    avg12mo,
  } = forecastMetrics;

  const isAdmin = user.role === 'admin';

  // Initialize funnel date range on component mount
  useEffect(() => {
    const initializeFunnelDateRange = async () => {
      if (data.funnel && data.funnel.length > 0) {
        try {
          const dateRange = await getFunnelDateRange();
          setFunnelDateRange(dateRange);
          setFunnelStartDate(dateRange.minDate);
          setFunnelEndDate(dateRange.maxDate);
          // Initialize with the existing funnel data
          setFunnelData(data.funnel);
        } catch (error) {
          console.error('Failed to fetch funnel date range:', error);
          setFunnelError(error instanceof Error ? error.message : 'Failed to load date range');
          // Fallback to existing funnel data
          setFunnelData(data.funnel || []);
        }
      }
    };

    initializeFunnelDateRange();
  }, [data.funnel]);

  // Fetch funnel data with date filtering
  const fetchFunnelData = useCallback(async (startDate: string, endDate: string) => {
    setIsFunnelLoading(true);
    setFunnelError(null);

    try {
      const filteredData = await getFunnelData(startDate, endDate);
      setFunnelData(filteredData);
    } catch (error) {
      console.error('Failed to fetch filtered funnel data:', error);
      setFunnelError(error instanceof Error ? error.message : 'Failed to load funnel data');
    } finally {
      setIsFunnelLoading(false);
    }
  }, []);

  // Handle date range changes
  const handleFunnelDateChange = useCallback((startDate: string, endDate: string) => {
    setFunnelStartDate(startDate);
    setFunnelEndDate(endDate);
    fetchFunnelData(startDate, endDate);
  }, [fetchFunnelData]);

  // Reset to full date range
  const handleFunnelDateReset = useCallback(() => {
    if (funnelDateRange) {
      setFunnelStartDate(funnelDateRange.minDate);
      setFunnelEndDate(funnelDateRange.maxDate);
      fetchFunnelData(funnelDateRange.minDate, funnelDateRange.maxDate);
    }
  }, [funnelDateRange, fetchFunnelData]);

  // Handle brush changes from RevenueChart
  const handleChartBrushChange = useCallback((startDate: string | null, endDate: string | null) => {
    setChartDateRange({ startDate, endDate });
  }, []);

  // Generate and download full report as PDF
  const handleGenerateAndDownloadReport = useCallback(async () => {
    setIsGeneratingReport(true);

    try {
      let reportData;

      if (uploadedFile) {
        // Use file-based endpoint when file is available
        reportData = await generateFullReport(uploadedFile);
      } else if (data && data.forecast && data.forecast.length > 0) {
        // Use data-based endpoint when loading from saved analysis
        // Construct minimal metadata from available data
        const constructedMetadata = {
          forecast_parameters: {
            forecast_date: new Date().toISOString().split('T')[0],
            forecast_periods: data.forecast.length,
            forecast_start: data.forecast[0]?.date,
            forecast_end: data.forecast[data.forecast.length - 1]?.date,
            models_trained: true
          },
          other: {
            forecast_summary: {
              total_forecast: data.forecast.reduce((sum, d) => sum + d.revenue, 0),
              average_monthly: data.forecast.reduce((sum, d) => sum + d.revenue, 0) / data.forecast.length,
            },
            key_drivers: data.keyDrivers || [],
            insights: data.insights || []
          },
          dataset_stats: (() => {
            if (!data.historical || data.historical.length === 0) {
              return { available: false };
            }

            const revenues = data.historical.map(d => d.revenue);
            const sortedRevenues = [...revenues].sort((a, b) => a - b);
            const sum = revenues.reduce((acc, r) => acc + r, 0);
            const avg = sum / revenues.length;
            const median = revenues.length % 2 === 0
              ? (sortedRevenues[revenues.length / 2 - 1] + sortedRevenues[revenues.length / 2]) / 2
              : sortedRevenues[Math.floor(revenues.length / 2)];
            const variance = revenues.reduce((acc, r) => acc + Math.pow(r - avg, 2), 0) / revenues.length;
            const std = Math.sqrt(variance);

            return {
              available: true,
              monthly_revenue_stats: {
                total_months: data.historical.length,
                average_monthly: avg,
                median_monthly: median,
                min_monthly: Math.min(...revenues),
                max_monthly: Math.max(...revenues),
                std_monthly: std,
                first_month: data.historical[0]?.date,
                last_month: data.historical[data.historical.length - 1]?.date
              }
            };
          })()
        };

        // Convert forecast array to the format expected by the report generator
        const forecastForReport = data.forecast.map(d => ({
          date: d.date,
          forecast: d.revenue,
          lower: d.revenue * 0.9,  // Approximate confidence interval
          upper: d.revenue * 1.1
        }));

        reportData = await generateReportFromData(constructedMetadata, forecastForReport);
      } else {
        alert('Unable to generate report: No data available. Please upload a CSV file or load a saved analysis.');
        setIsGeneratingReport(false);
        return;
      }

      // Fetch report data from API

      // Generate PDF from report data
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();

      let yPos = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;

      // Helper to format currency values
      const formatCurrency = (val: any) => {
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(num)) return val;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
      };

      // Helper to add text with word wrap
      const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10, lineHeight: number = 5) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        return y + (lines.length * lineHeight);
      };

      // Helper to check if we need a new page
      const checkNewPage = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
          return true;
        }
        return false;
      };

      // Title Page with Logo
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');

      // Add logo
      try {
        const logoImg = new Image();
        logoImg.src = '/header_logo.png';
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
          setTimeout(reject, 3000); // Timeout after 3s
        });

        // Add logo centered at top
        const logoWidth = 40;
        const logoHeight = (logoImg.height * logoWidth) / logoImg.width;
        doc.addImage(logoImg, 'PNG', (pageWidth - logoWidth) / 2, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 10;
      } catch (e) {
        console.log('Could not load logo:', e);
      }

      doc.text('Strategic Analysis Report', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 20;

      // Executive Summary
      if (reportData.executive_summary) {
        checkNewPage(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Executive Summary', margin, yPos);
        yPos += 6;

        doc.setFont('helvetica', 'normal');

        // Overview
        if (reportData.executive_summary.overview) {
          yPos = addWrappedText(reportData.executive_summary.overview, margin, yPos, maxWidth);
          yPos += 4;
        }

        // Total Forecast
        if (reportData.executive_summary.total_forecast) {
          doc.setFont('helvetica', 'bold');
          const totalForecastFormatted = formatCurrency(reportData.executive_summary.total_forecast);
          yPos = addWrappedText(`Total Forecast: ${totalForecastFormatted}`, margin, yPos, maxWidth);
          doc.setFont('helvetica', 'normal');
          yPos += 2;
        }

        // Forecast Period
        if (reportData.executive_summary.forecast_period) {
          const period = reportData.executive_summary.forecast_period;
          const periodStr = typeof period === 'object' && period !== null
            ? `${period.start || ''} to ${period.end || ''}`
            : (period || 'N/A');
          yPos = addWrappedText(`Period: ${periodStr}`, margin, yPos, maxWidth);
          yPos += 4;
        }

        // Key Insights
        if (reportData.executive_summary.key_insights && Array.isArray(reportData.executive_summary.key_insights) && reportData.executive_summary.key_insights.length > 0) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Key Insights:', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          reportData.executive_summary.key_insights.forEach((insight: string) => {
            checkNewPage(15);
            yPos = addWrappedText(`• ${insight}`, margin + 5, yPos, maxWidth - 5);
            yPos += 2;
          });
        }
        yPos += 6;
      }

      // Driving Factors
      if (reportData.driving_factors) {
        checkNewPage(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Driving Factors', margin, yPos);
        yPos += 6;

        // Positive Factors
        if (reportData.driving_factors.positive_factors && Array.isArray(reportData.driving_factors.positive_factors) && reportData.driving_factors.positive_factors.length > 0) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(22, 163, 74); // green-600
          doc.text('Positive Factors', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          reportData.driving_factors.positive_factors.forEach((item: any) => {
            checkNewPage(25);
            const factor = typeof item === 'string' ? item : item.factor || '';
            const impact = typeof item === 'object' && item.impact ? ` (Impact: ${formatCurrency(item.impact)})` : '';
            const evidence = typeof item === 'object' && item.evidence ? `\n  Evidence: ${item.evidence}` : '';

            yPos = addWrappedText(`+ ${factor}${impact}`, margin + 5, yPos, maxWidth - 5);
            if (evidence) {
              doc.setFontSize(9);
              doc.setTextColor(64, 64, 64);
              yPos = addWrappedText(evidence, margin + 8, yPos, maxWidth - 8, 9);
              doc.setFontSize(10);
              doc.setTextColor(0, 0, 0);
            }
            yPos += 2;
          });
          yPos += 4;
        }

        // Negative Factors
        if (reportData.driving_factors.negative_factors && Array.isArray(reportData.driving_factors.negative_factors) && reportData.driving_factors.negative_factors.length > 0) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(220, 38, 38); // red-600
          doc.text('Risk Factors', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          reportData.driving_factors.negative_factors.forEach((item: any) => {
            checkNewPage(25);
            const factor = typeof item === 'string' ? item : item.factor || '';
            const impact = typeof item === 'object' && item.impact ? ` (Impact: ${formatCurrency(item.impact)})` : '';
            const evidence = typeof item === 'object' && item.evidence ? `\n  Evidence: ${item.evidence}` : '';

            yPos = addWrappedText(`- ${factor}${impact}`, margin + 5, yPos, maxWidth - 5);
            if (evidence) {
              doc.setFontSize(9);
              doc.setTextColor(64, 64, 64);
              yPos = addWrappedText(evidence, margin + 8, yPos, maxWidth - 8, 9);
              doc.setFontSize(10);
              doc.setTextColor(0, 0, 0);
            }
            yPos += 2;
          });
          yPos += 4;
        }

        // Seasonal Patterns
        if (reportData.driving_factors.seasonal_patterns) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text('Seasonal Patterns', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          yPos = addWrappedText(reportData.driving_factors.seasonal_patterns, margin + 5, yPos, maxWidth - 5);
          yPos += 4;
        }

        // Trend Analysis
        if (reportData.driving_factors.trend_analysis) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Trend Analysis', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          yPos = addWrappedText(reportData.driving_factors.trend_analysis, margin + 5, yPos, maxWidth - 5);
          yPos += 4;
        }
        yPos += 6;
      }

      // Outliers & Anomalies
      if (reportData.outliers_and_anomalies) {
        checkNewPage(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Outliers & Anomalies', margin, yPos);
        yPos += 6;

        // Forecast Outliers
        if (reportData.outliers_and_anomalies.forecast_outliers && Array.isArray(reportData.outliers_and_anomalies.forecast_outliers) && reportData.outliers_and_anomalies.forecast_outliers.length > 0) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Forecast Outliers', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          reportData.outliers_and_anomalies.forecast_outliers.forEach((outlier: any) => {
            checkNewPage(30);
            const period = outlier.period || 'Unknown period';
            const value = outlier.value || 'N/A';
            const deviation = outlier.deviation || 'N/A';

            yPos = addWrappedText(`• Period: ${period}`, margin + 5, yPos, maxWidth - 5);
            yPos = addWrappedText(`  Value: ${value}, Deviation: ${deviation}`, margin + 8, yPos, maxWidth - 8);

            if (outlier.potential_causes && Array.isArray(outlier.potential_causes) && outlier.potential_causes.length > 0) {
              yPos = addWrappedText(`  Potential Causes: ${outlier.potential_causes.join(', ')}`, margin + 8, yPos, maxWidth - 8);
            }
            yPos += 2;
          });
          yPos += 4;
        }

        // Data Quality Issues
        if (reportData.outliers_and_anomalies.data_quality_issues && Array.isArray(reportData.outliers_and_anomalies.data_quality_issues) && reportData.outliers_and_anomalies.data_quality_issues.length > 0) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Data Quality Issues', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          reportData.outliers_and_anomalies.data_quality_issues.forEach((issue: string) => {
            checkNewPage(15);
            yPos = addWrappedText(`• ${issue}`, margin + 5, yPos, maxWidth - 5);
            yPos += 2;
          });
          yPos += 4;
        }

        // Model Uncertainty
        if (reportData.outliers_and_anomalies.model_uncertainty) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Model Uncertainty', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          yPos = addWrappedText(reportData.outliers_and_anomalies.model_uncertainty, margin + 5, yPos, maxWidth - 5);
          yPos += 4;
        }
        yPos += 6;
      }

      // Operational Recommendations
      if (reportData.operational_recommendations) {
        checkNewPage(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Operational Recommendations', margin, yPos);
        yPos += 6;

        // Immediate Actions
        if (reportData.operational_recommendations.immediate_actions && Array.isArray(reportData.operational_recommendations.immediate_actions) && reportData.operational_recommendations.immediate_actions.length > 0) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(239, 68, 68); // red-500
          doc.text('Immediate Actions', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          reportData.operational_recommendations.immediate_actions.forEach((item: any, idx: number) => {
            checkNewPage(30);
            const action = typeof item === 'string' ? item : item.action || '';
            const priority = typeof item === 'object' && item.priority ? ` [${item.priority} Priority]` : '';
            const rationale = typeof item === 'object' && item.rationale ? `\n  Rationale: ${item.rationale}` : '';
            const impact = typeof item === 'object' && item.expected_impact ? `\n  Expected Impact: ${formatCurrency(item.expected_impact)}` : '';

            yPos = addWrappedText(`${idx + 1}. ${action}${priority}`, margin + 5, yPos, maxWidth - 5);
            if (rationale) {
              doc.setFontSize(9);
              doc.setTextColor(64, 64, 64);
              yPos = addWrappedText(rationale, margin + 8, yPos, maxWidth - 8, 9);
              doc.setFontSize(10);
              doc.setTextColor(0, 0, 0);
            }
            if (impact) {
              doc.setFontSize(9);
              doc.setTextColor(64, 64, 64);
              yPos = addWrappedText(impact, margin + 8, yPos, maxWidth - 8, 9);
              doc.setFontSize(10);
              doc.setTextColor(0, 0, 0);
            }
            yPos += 2;
          });
          yPos += 4;
        }

        // Strategic Initiatives
        if (reportData.operational_recommendations.strategic_initiatives && Array.isArray(reportData.operational_recommendations.strategic_initiatives) && reportData.operational_recommendations.strategic_initiatives.length > 0) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(59, 130, 246); // blue-500
          doc.text('Strategic Initiatives', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          reportData.operational_recommendations.strategic_initiatives.forEach((item: any, idx: number) => {
            checkNewPage(30);
            const initiative = typeof item === 'string' ? item : item.initiative || '';
            const timeframe = typeof item === 'object' && item.timeframe ? ` [${item.timeframe}]` : '';

            yPos = addWrappedText(`${idx + 1}. ${initiative}${timeframe}`, margin + 5, yPos, maxWidth - 5);
            yPos += 2;
          });
          yPos += 4;
        }

        // Risk Mitigation
        if (reportData.operational_recommendations.risk_mitigation && Array.isArray(reportData.operational_recommendations.risk_mitigation) && reportData.operational_recommendations.risk_mitigation.length > 0) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(245, 158, 11); // amber-500
          doc.text('Risk Mitigation', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          reportData.operational_recommendations.risk_mitigation.forEach((item: any, idx: number) => {
            checkNewPage(30);
            const risk = typeof item === 'string' ? item : item.risk || '';
            const mitigation = typeof item === 'object' && item.mitigation ? item.mitigation : '';
            const priority = typeof item === 'object' && item.priority ? ` [${item.priority} Priority]` : '';

            yPos = addWrappedText(`${idx + 1}. ${risk}${priority}`, margin + 5, yPos, maxWidth - 5);
            if (mitigation) {
              doc.setFontSize(9);
              doc.setTextColor(64, 64, 64);
              yPos = addWrappedText(`  Mitigation: ${mitigation}`, margin + 8, yPos, maxWidth - 8, 9);
              doc.setFontSize(10);
              doc.setTextColor(0, 0, 0);
            }
            yPos += 2;
          });
          yPos += 4;
        }

        // Optimization Opportunities
        if (reportData.operational_recommendations.optimization_opportunities && Array.isArray(reportData.operational_recommendations.optimization_opportunities) && reportData.operational_recommendations.optimization_opportunities.length > 0) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(16, 185, 129); // green-500
          doc.text('Optimization Opportunities', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          reportData.operational_recommendations.optimization_opportunities.forEach((item: any, idx: number) => {
            checkNewPage(30);
            const opportunity = typeof item === 'string' ? item : item.opportunity || '';
            const description = typeof item === 'object' && item.description ? item.description : '';
            const benefit = typeof item === 'object' && item.expected_benefit ? item.expected_benefit : '';

            yPos = addWrappedText(`${idx + 1}. ${opportunity}`, margin + 5, yPos, maxWidth - 5);
            if (description) {
              doc.setFontSize(9);
              doc.setTextColor(64, 64, 64);
              yPos = addWrappedText(`  ${description}`, margin + 8, yPos, maxWidth - 8, 9);
              doc.setTextColor(0, 0, 0);
            }
            if (benefit) {
              doc.setFontSize(9);
              doc.setTextColor(64, 64, 64);
              yPos = addWrappedText(`  Expected Benefit: ${benefit}`, margin + 8, yPos, maxWidth - 8, 9);
              doc.setFontSize(10);
              doc.setTextColor(0, 0, 0);
            }
            yPos += 2;
          });
          yPos += 4;
        }
        yPos += 6;
      }

      // Model Performance Assessment
      if (reportData.model_performance_assessment) {
        checkNewPage(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Model Performance Assessment', margin, yPos);
        yPos += 6;

        // Overall Confidence
        if (reportData.model_performance_assessment.overall_confidence) {
          checkNewPage(20);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Overall Confidence:', margin, yPos);
          doc.setFont('helvetica', 'normal');
          doc.text(reportData.model_performance_assessment.overall_confidence, margin + 42, yPos);
          yPos += 6;
        }

        // Model Reliability
        if (reportData.model_performance_assessment.model_reliability) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Model Reliability', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          yPos = addWrappedText(reportData.model_performance_assessment.model_reliability, margin + 5, yPos, maxWidth - 5);
          yPos += 4;
        }

        // Recommendations for Improvement
        if (reportData.model_performance_assessment.recommendations_for_improvement && Array.isArray(reportData.model_performance_assessment.recommendations_for_improvement) && reportData.model_performance_assessment.recommendations_for_improvement.length > 0) {
          checkNewPage(30);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Recommendations for Improvement', margin, yPos);
          yPos += 4;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          reportData.model_performance_assessment.recommendations_for_improvement.forEach((rec: string) => {
            checkNewPage(15);
            yPos = addWrappedText(`• ${rec}`, margin + 5, yPos, maxWidth - 5);
            yPos += 2;
          });
          yPos += 4;
        }
      }

      // Analyst Notes
      if (reportData.analyst_notes) {
        checkNewPage(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Analyst Notes', margin, yPos);
        yPos += 6;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        yPos = addWrappedText(reportData.analyst_notes, margin, yPos, maxWidth);
      }

      // Revenue Forecast Chart - using SVG to Canvas approach
      try {
        const chartContainer = document.getElementById('revenue-chart-container');
        console.log('Chart capture - container found:', !!chartContainer);

        if (chartContainer) {
          // Find the SVG element inside the chart container (Recharts renders to SVG)
          const svgElement = chartContainer.querySelector('svg.recharts-surface');
          console.log('Chart capture - SVG element found:', !!svgElement);

          if (svgElement) {
            // Clone the SVG to avoid modifying the original
            const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

            // Get the SVG dimensions
            const svgRect = svgElement.getBoundingClientRect();
            const svgWidth = svgRect.width || 800;
            const svgHeight = svgRect.height || 400;

            // Set explicit dimensions on the cloned SVG
            clonedSvg.setAttribute('width', String(svgWidth));
            clonedSvg.setAttribute('height', String(svgHeight));

            // Add white background to the SVG
            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('width', '100%');
            bgRect.setAttribute('height', '100%');
            bgRect.setAttribute('fill', 'white');
            clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

            // Serialize the SVG to a string
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(clonedSvg);

            // Create a Blob from the SVG string
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);

            // Create an Image and load the SVG
            const img = new Image();

            // Wait for the image to load
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = (e) => reject(e);
              img.src = svgUrl;
            });

            // Create a canvas and draw the image
            const canvas = document.createElement('canvas');
            const scale = 2; // Higher resolution
            canvas.width = svgWidth * scale;
            canvas.height = svgHeight * scale;

            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.scale(scale, scale);
              ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
            }

            // Clean up the blob URL
            URL.revokeObjectURL(svgUrl);

            console.log('Chart capture - canvas size:', canvas.width, 'x', canvas.height);

            if (canvas.width > 0 && canvas.height > 0) {
              const imgData = canvas.toDataURL('image/png');
              const imgWidth = pageWidth - 2 * margin;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;

              // Add new page for chart
              doc.addPage();
              yPos = 20;

              doc.setFontSize(14);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(0, 0, 0);
              doc.text('Revenue Forecast Chart', margin, yPos);
              yPos += 15;

              // Add the chart image
              doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
              console.log('Chart capture - successfully added to PDF');
            } else {
              console.error('Chart capture - canvas is empty');
            }
          } else {
            console.error('Chart capture - SVG element not found in container');
          }
        } else {
          console.error('Chart capture - revenue-chart-container not found');
        }
      } catch (error) {
        console.error('Failed to capture revenue chart:', error);
      }

      // Forecast Data Table
      const forecastData = simulatedData.filter(d => d.type === 'forecast');

      if (forecastData.length > 0) {
        doc.addPage();
        yPos = 20;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('12-Month Forecast Data', margin, yPos);
        yPos += 15;

        // Check if confidence intervals are available
        const hasConfidenceIntervals = forecastData.some(d => d.lower !== undefined && d.upper !== undefined);

        // Table header
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(243, 244, 246); // gray-100
        doc.rect(margin, yPos, maxWidth, 10, 'F');

        doc.setTextColor(0, 0, 0);
        doc.text('Month', margin + 5, yPos + 7);
        doc.text('Revenue', margin + 55, yPos + 7, { align: 'right' });
        if (hasConfidenceIntervals) {
          doc.text('Confidence', margin + 110, yPos + 7, { align: 'right' });
        }
        doc.text('Type', margin + maxWidth - 20, yPos + 7, { align: 'center' });
        yPos += 10;

        // Table rows
        doc.setFont('helvetica', 'normal');
        forecastData.forEach((point, index) => {
          checkNewPage(10);

          // Alternating row colors
          if (index % 2 === 1) {
            doc.setFillColor(249, 250, 251); // gray-50
            doc.rect(margin, yPos, maxWidth, 10, 'F');
          }

          const date = new Date(point.date);
          const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric'
          });
          const formattedRevenue = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
          }).format(point.revenue);

          // Calculate confidence interval
          let confidenceText = '-';
          if (point.lower !== undefined && point.upper !== undefined) {
            const interval = (point.upper - point.lower) / 2;
            confidenceText = '± ' + new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0
            }).format(interval);
          }

          doc.setTextColor(0, 0, 0);
          doc.text(formattedDate, margin + 5, yPos + 7);
          doc.text(formattedRevenue, margin + 55, yPos + 7, { align: 'right' });
          if (hasConfidenceIntervals) {
            doc.text(confidenceText, margin + 110, yPos + 7, { align: 'right' });
          }
          doc.text('Forecast', margin + maxWidth - 20, yPos + 7, { align: 'center' });

          yPos += 10;
        });
      }

      // Add page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      doc.save('strategic-analysis-report.pdf');
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  }, [uploadedFile, simulatedData, data.metadata, data.forecast]);

  // Generate CSV content from table data
  const generateTableCSV = (data: typeof simulatedData): string => {
    const headers = ['Date', 'Revenue', 'Type'];
    if (data.some(d => d.bookings !== undefined && d.bookings !== null)) {
      headers.push('Bookings');
    }
    
    const rows = data.map(point => {
      const date = new Date(point.date);
      const formattedDate = date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
      const revenue = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        maximumFractionDigits: 0 
      }).format(point.revenue);
      
      const row = [
        formattedDate,
        revenue,
        point.type === 'forecast' ? 'Forecast' : 'Historical'
      ];
      
      if (point.bookings !== undefined && point.bookings !== null) {
        row.push(point.bookings.toString());
      }
      
      return row;
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
  };

  // Download CSV file
  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveClick = () => {
    const scenarioName = window.prompt("Enter a name for this forecast scenario:", `Forecast ${new Date().toLocaleDateString()}`);
    if (scenarioName) {
      onSave(scenarioName);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <button
            onClick={onReset}
            className="flex items-center text-slate-500 hover:text-slate-800 transition-colors px-3 py-2 hover:bg-slate-100 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Upload
          </button>
          <div className="h-6 w-px bg-slate-200"></div>
          <button
            onClick={handleSaveClick}
            disabled={isSaving}
            className="flex items-center text-brand-600 hover:text-brand-700 font-medium px-3 py-2 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Progress
          </button>
          {isAdmin && (
            <button
              onClick={handleGenerateAndDownloadReport}
              disabled={isGeneratingReport || !data}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingReport ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Full Report
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('forecast')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'forecast' ? 'bg-brand-100 text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Forecast & Simulation
          </button>
          <div className="relative group">
            <button
              onClick={() => isAdmin && setActiveTab('insights')}
              disabled={!isAdmin}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center ${
                activeTab === 'insights'
                  ? 'bg-brand-100 text-brand-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Strategic Insights
              {!isAdmin && <Lock className="w-3 h-3 ml-2 text-slate-400" />}
            </button>
            {!isAdmin && (
               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center z-10">
                 Restricted to Admins
               </div>
            )}
          </div>
        </div>
      </div>


      <div data-forecast-section className={activeTab === 'forecast' ? '' : 'hidden'}>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Charts Panel - Full width */}
          <div className="w-full">
            <div id="forecast-overview-panel" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Forecast Overview</h3>
              
              {/* Stats Cards */}
              <div id="forecast-stats-cards" className="space-y-4 mb-8">
                {/* Primary Card: 12 Month Forecast */}
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-2 h-2 bg-brand-500 rounded-full"></div>
                    <h4 className="text-sm font-semibold text-slate-700">Forecasted Revenue (12 months)</h4>
                  </div>
                  <p className="text-4xl font-bold text-slate-900 mb-3">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalForecastRevenue)}
                  </p>
                  <div className="border-t border-slate-200 pt-3">
                    <div className="flex items-center space-x-4 text-sm text-slate-600">
                      <span>
                        {diff >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(diff)} ({diffPercent.toFixed(1)}%) vs Baseline
                      </span>
                      <span className="text-slate-400">|</span>
                      <span>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(avg12mo)}/mo avg
                      </span>
                    </div>
                  </div>
                </div>

                {/* Secondary Cards: Short-term Forecasts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 1 Month */}
                  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">1 Month</p>
                    <p className="text-2xl font-bold text-slate-900 mb-2">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(forecast1mo)}
                    </p>
                    <div className={`flex items-center space-x-1 text-xs font-medium ${
                      compare1mo >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {compare1mo < 0 && <TrendingDown className="w-3 h-3" />}
                      {compare1mo >= 0 && <TrendingUp className="w-3 h-3" />}
                      <span>
                        {Math.abs(compare1mo).toFixed(0)}% vs avg
                      </span>
                    </div>
                  </div>

                  {/* 3 Months */}
                  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">3 Months</p>
                    <p className="text-2xl font-bold text-slate-900 mb-2">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(forecast3mo)}
                    </p>
                    <div className={`flex items-center space-x-1 text-xs font-medium ${
                      compare3mo >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {compare3mo < 0 && <TrendingDown className="w-3 h-3" />}
                      {compare3mo >= 0 && <TrendingUp className="w-3 h-3" />}
                      <span>
                        {Math.abs(compare3mo).toFixed(0)}% vs avg
                      </span>
                    </div>
                  </div>

                  {/* 6 Months */}
                  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">6 Months</p>
                    <p className="text-2xl font-bold text-slate-900 mb-2">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(forecast6mo)}
                    </p>
                    <div className={`flex items-center space-x-1 text-xs font-medium ${
                      compare6mo >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {compare6mo < 0 && <TrendingDown className="w-3 h-3" />}
                      {compare6mo >= 0 && <TrendingUp className="w-3 h-3" />}
                      <span>
                        {Math.abs(compare6mo).toFixed(0)}% vs avg
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Revenue Chart */}
              <div id="revenue-chart-container">
                <RevenueChart data={simulatedData} onBrushChange={handleChartBrushChange} />
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-semibold text-slate-900">Revenue Data</h3>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={showHistoricData}
                          onChange={(e) => setShowHistoricData(e.target.checked)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 focus:ring-offset-0"
                        />
                        <span>Show Historic Data</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        const csvContent = generateTableCSV(filteredTableData);
                        downloadCSV(csvContent, 'revenue_data.csv');
                      }}
                      className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      title="Download as CSV"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Download
                    </button>
                    <button
                      onClick={() => setIsTableMinimized(!isTableMinimized)}
                      className="flex items-center justify-center p-1.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      aria-label={isTableMinimized ? "Expand table" : "Minimize table"}
                      title={isTableMinimized ? "Expand table" : "Minimize table"}
                    >
                      {isTableMinimized ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                {!isTableMinimized && (
                  <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Revenue</th>
                        {filteredTableData.some(d => d.lower !== undefined && d.upper !== undefined) && (
                          <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Confidence Interval</th>
                        )}
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                        {filteredTableData.some(d => d.bookings !== undefined && d.bookings !== null) && (
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Bookings</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {filteredTableData.map((point, index) => {
                        const date = new Date(point.date);
                        const formattedDate = date.toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric'
                        });
                        const isForecast = point.type === 'forecast';
                        const hasConfidenceData = point.lower !== undefined && point.upper !== undefined;
                        const showConfidenceColumn = filteredTableData.some(d => d.lower !== undefined && d.upper !== undefined);

                        // Calculate confidence interval
                        const confidenceInterval = hasConfidenceData
                          ? (point.upper! - point.lower!) / 2
                          : null;

                        return (
                          <tr
                            key={`${point.date}-${index}`}
                            className={`hover:bg-slate-50 transition-colors ${
                              isForecast ? 'bg-purple-50/30' : ''
                            }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                              {formattedDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-slate-900">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                maximumFractionDigits: 0
                              }).format(point.revenue)}
                            </td>
                            {showConfidenceColumn && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-slate-600">
                                {confidenceInterval !== null ? (
                                  <span className="font-medium text-purple-700">
                                    ± {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: 'USD',
                                      maximumFractionDigits: 0
                                    }).format(confidenceInterval)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                isForecast
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-sky-100 text-sky-700'
                              }`}>
                                {isForecast ? 'Forecast' : 'Historical'}
                              </span>
                            </td>
                            {filteredTableData.some(d => d.bookings !== undefined && d.bookings !== null) && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-600">
                                {point.bookings !== undefined && point.bookings !== null
                                  ? point.bookings.toLocaleString()
                                  : ''
                                }
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {activeTab === 'insights' && isAdmin && (
        <div id="insights-section" className="space-y-8">
            {/* Top Row: Key Drivers and Strategic Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-amber-500" />
                  Key Drivers
                </h3>
                <ul className="space-y-4">
                  {data.keyDrivers.map((driver, idx) => (
                    <li key={idx} className="flex items-start">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                        {idx + 1}
                      </div>
                      <span className="text-slate-700">{driver}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-brand-500" />
                  AI Strategic Analysis
                </h3>
                <div className="space-y-4">
                  {data.insights.map((insight, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                       <p className="text-slate-700 leading-relaxed text-sm">{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row: Pipeline Funnel */}
            {data.funnel && data.funnel.length > 0 && (
              <div id="funnel-chart-container" className="space-y-0">
                {/* Funnel Error Message */}
                {funnelError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start mb-4">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-red-800 mb-1">Funnel Data Error</h4>
                      <p className="text-sm text-red-700">{funnelError}</p>
                      <button
                        onClick={() => setFunnelError(null)}
                        className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {/* Funnel Chart with filtered data and integrated date filter */}
                <FunnelChart
                  data={funnelData}
                  showLost={false}
                  showCancelled={false}
                  dateFilter={funnelDateRange ? {
                    startDate: funnelStartDate,
                    endDate: funnelEndDate,
                    minDate: funnelDateRange.minDate,
                    maxDate: funnelDateRange.maxDate,
                    onDateChange: handleFunnelDateChange,
                    onReset: handleFunnelDateReset,
                    isLoading: isFunnelLoading
                  } : undefined}
                />
              </div>
            )}
        </div>
      )}

    </div>
  );
};
