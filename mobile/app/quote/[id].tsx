import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  DetailHeroCard,
  DetailInfoRow,
  DetailSectionCard,
  DetailFooter,
  DetailLoading,
  DetailNotFound,
  DetailActionButton,
  DetailMoreActions,
  type DetailMoreAction,
  EntityDetailHeader,
  useEntityDetailTheme,
} from '@/components/EntityDetailLayout';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/context/AuthContext';
import { useShopOptional } from '@/context/ShopContext';
import { useExclusiveAction } from '@/hooks/useExclusiveAction';
import { resolveBusinessType } from '@/constants';
import { quoteService } from '@/services/quoteService';
import { shareQuotePdf } from '@/services/pdfDocumentService';
import { formatCurrency, formatDate } from '@/utils/formatCurrency';
import { formatStatusLabel } from '@/utils/formatLabels';
import { getApiErrorMessage, parseApiEntity } from '@/utils/parseApiListResponse';
import { refreshAfterQuoteChange, refreshAfterQuoteToJob, refreshAfterSale } from '@/utils/queryInvalidation';

type QuoteDetail = {
  id: string;
  quoteNumber?: string;
  title?: string;
  totalAmount?: number;
  status: string;
  validUntil?: string;
  createdAt: string;
  customer?: { name?: string };
  items?: Array<{ description: string; quantity: number; unitPrice: number; total?: number }>;
};

type QuoteAction = 'status' | 'convert' | 'convertSale' | 'pdf' | 'delete';

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeTenant, isAdmin } = useAuth();
  const shopContext = useShopOptional();
  const { colors, borderColor, textColor } = useEntityDetailTheme();
  const { isAnyActionActive, isActionActive, runExclusiveAction } = useExclusiveAction<QuoteAction>();

  const resolvedType = resolveBusinessType(activeTenant?.businessType);
  const isStudio = resolvedType === 'studio';
  const isRetail = resolvedType === 'shop' || resolvedType === 'pharmacy';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => quoteService.getQuoteById(String(id)),
    enabled: !!id,
  });

  const quote = useMemo(() => parseApiEntity<QuoteDetail>(data), [data]);

  const handleMarkStatus = useCallback(
    async (newStatus: 'sent' | 'accepted') => {
      if (!quote) return;
      await runExclusiveAction('status', async () => {
        try {
          await quoteService.updateStatus(quote.id, newStatus);
          await refetch();
          await refreshAfterQuoteChange(queryClient);
          Alert.alert('Success', `Quote marked as ${formatStatusLabel(newStatus)}`);
        } catch (err: unknown) {
          Alert.alert('Error', getApiErrorMessage(err, 'Failed to update quote status'));
        }
      });
    },
    [quote, queryClient, refetch, runExclusiveAction]
  );

  const handleConvertToJob = useCallback(async () => {
    if (!quote) return;
    await runExclusiveAction('convert', async () => {
      try {
        const res = await quoteService.convertToJob(quote.id);
        const dataRes = res?.data ?? res;
        const job: { jobNumber?: string } =
          (dataRes as { job?: { jobNumber?: string } })?.job ??
          (dataRes as { data?: { job?: { jobNumber?: string } } })?.data?.job ??
          (dataRes as { jobNumber?: string });
        Alert.alert('Success', `Quote converted to job${job?.jobNumber ? ` ${job.jobNumber}` : ''}.`);
        await refreshAfterQuoteToJob(queryClient);
      } catch (err: unknown) {
        Alert.alert('Error', getApiErrorMessage(err, 'Failed to convert quote to job.'));
      }
    });
  }, [quote, queryClient, runExclusiveAction]);

  const handleConvertToSale = useCallback(async () => {
    if (!quote) return;
    await runExclusiveAction('convertSale', async () => {
      try {
        const res = await quoteService.convertToSale(quote.id, {
          paymentMethod: 'credit',
          shopId: shopContext?.activeShop?.id ?? null,
        });
        const payload = res?.data ?? res;
        const saleId =
          (payload as { sale?: { id?: string } })?.sale?.id ??
          (payload as { id?: string })?.id ??
          (payload as { saleId?: string })?.saleId;
        await refreshAfterSale(queryClient);
        if (saleId) {
          router.push(`/sale/${encodeURIComponent(saleId)}` as never);
          return;
        }
        Alert.alert('Success', 'Quote converted to sale.');
      } catch (err: unknown) {
        Alert.alert('Error', getApiErrorMessage(err, 'Failed to convert quote to sale.'));
      }
    });
  }, [queryClient, quote, router, runExclusiveAction, shopContext?.activeShop?.id]);

  const handleDownloadQuote = useCallback(async () => {
    if (!quote) return;
    await runExclusiveAction('pdf', async () => {
      try {
        await shareQuotePdf(quote as unknown as Record<string, unknown>);
      } catch (err: unknown) {
        Alert.alert('Quote unavailable', err instanceof Error ? err.message : 'Could not prepare this quote PDF.');
      }
    });
  }, [quote, runExclusiveAction]);

  const handleDeleteQuote = useCallback(() => {
    if (!quote) return;
    Alert.alert('Delete quote', 'Delete this quote permanently?', [
      { text: 'Keep quote', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          runExclusiveAction('delete', async () => {
            try {
              await quoteService.deleteQuote(quote.id);
              await refreshAfterQuoteChange(queryClient);
              Alert.alert('Deleted', 'Quote deleted');
              router.back();
            } catch (err: unknown) {
              Alert.alert('Error', getApiErrorMessage(err, 'Failed to delete quote'));
            }
          }),
      },
    ]);
  }, [queryClient, quote, router, runExclusiveAction]);

  if (isLoading) return <DetailLoading title="Quote" />;
  if (!quote) return <DetailNotFound title="Quote" entityLabel="Quote" />;

  const canConvertQuote = quote.status !== 'declined' && quote.status !== 'expired';
  const conversionAction = isRetail
    ? {
        label: 'Convert to sale',
        actionKey: 'convertSale' as const,
        onPress: handleConvertToSale,
      }
    : isStudio
      ? {
          label: 'Convert to job',
          actionKey: 'convert' as const,
          onPress: handleConvertToJob,
        }
      : null;
  const hasPrimaryConversion = Boolean(conversionAction && canConvertQuote);
  const quoteStatusAction = quote.status === 'draft'
    ? { key: 'markSent', label: 'Mark as sent', onPress: () => handleMarkStatus('sent') }
    : quote.status === 'sent'
      ? { key: 'markAccepted', label: 'Mark accepted', onPress: () => handleMarkStatus('accepted') }
      : null;
  const quotePrimaryIsStatus = !hasPrimaryConversion && Boolean(quoteStatusAction);
  const quotePrimaryIsPdf = !hasPrimaryConversion && !quotePrimaryIsStatus;
  const quoteMoreActions: DetailMoreAction[] = [
    ...(!quotePrimaryIsPdf
      ? [{
          key: 'pdf',
          label: 'PDF',
          icon: 'download' as const,
          onPress: handleDownloadQuote,
          loading: isActionActive('pdf'),
          disabled: isAnyActionActive,
        }]
      : []),
    ...(quoteStatusAction && !quotePrimaryIsStatus
      ? [{
          key: quoteStatusAction.key,
          label: quoteStatusAction.label,
          onPress: quoteStatusAction.onPress,
          loading: isActionActive('status'),
          disabled: isAnyActionActive,
        }]
      : []),
    ...(isAdmin
      ? [{
          key: 'delete',
          label: 'Delete',
          variant: 'danger' as const,
          onPress: handleDeleteQuote,
          loading: isActionActive('delete'),
          disabled: isAnyActionActive,
        }]
      : []),
  ];

  return (
    <>
      <EntityDetailHeader title={quote.quoteNumber || 'Quote details'} />
      <ScreenShell style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <DetailHeroCard
            eyebrow={quote.quoteNumber || 'Quote'}
            title={formatStatusLabel(quote.status)}
            message={quote.title || 'Quote details are ready for review.'}
            metricLabel="Total Amount"
            metricValue={formatCurrency(quote.totalAmount)}
            secondaryIcon="archive"
            secondaryLabel="Items"
            secondaryValue={`${quote.items?.length || 0} ${(quote.items?.length || 0) === 1 ? 'Item' : 'Items'}`}
          />

          <DetailSectionCard title="Quote Details" icon="file-text">
            <DetailInfoRow icon="file-text" label="Title" value={quote.title || '—'} />
            <DetailInfoRow icon="user" label="Customer" value={quote.customer?.name ?? '—'} />
            <DetailInfoRow icon="tag" label="Status" value={formatStatusLabel(quote.status)} />
            {quote.validUntil ? (
              <DetailInfoRow icon="calendar" label="Valid Until" value={formatDate(quote.validUntil)} />
            ) : null}
            <DetailInfoRow icon="calendar" label="Created" value={formatDate(quote.createdAt)} />
          </DetailSectionCard>
          {quote.items && quote.items.length > 0 ? (
            <DetailSectionCard title="Quote Items" icon="archive">
              {quote.items.map((item, i) => (
                <View key={i} style={[styles.itemRow, i > 0 && { borderTopColor: borderColor, borderTopWidth: 1 }]}>
                  <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                    {item.description} x{item.quantity}
                  </Text>
                  <Text style={[styles.itemTotal, { color: textColor }]}>
                    {formatCurrency(item.total || item.unitPrice * item.quantity)}
                  </Text>
                </View>
              ))}
            </DetailSectionCard>
          ) : null}
        </ScrollView>
        <DetailFooter>
          {hasPrimaryConversion && conversionAction ? (
            <DetailActionButton
              label={conversionAction.label}
              variant="primary"
              onPress={conversionAction.onPress}
              loading={isActionActive(conversionAction.actionKey)}
              disabled={isAnyActionActive}
            />
          ) : quoteStatusAction ? (
            <DetailActionButton
              label={quoteStatusAction.label}
              variant="primary"
              onPress={quoteStatusAction.onPress}
              loading={isActionActive('status')}
              disabled={isAnyActionActive}
            />
          ) : (
            <DetailActionButton
              label="PDF"
              icon="download"
              variant="primary"
              onPress={handleDownloadQuote}
              loading={isActionActive('pdf')}
              disabled={isAnyActionActive}
            />
          )}
          <DetailMoreActions actions={quoteMoreActions} disabled={isAnyActionActive} />
        </DetailFooter>
      </ScreenShell>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16 },
  section: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemName: { flex: 1, fontSize: 14 },
  itemTotal: { fontSize: 14, fontWeight: '600' },
});
