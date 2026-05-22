import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  DetailCard,
  DetailFooter,
  DetailLoading,
  DetailNotFound,
  DetailRow,
  DetailActionButton,
  EntityDetailHeader,
  useEntityDetailTheme,
} from '@/components/EntityDetailLayout';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/context/AuthContext';
import { resolveBusinessType } from '@/constants';
import { quoteService } from '@/services/quoteService';
import { formatCurrency, formatDate } from '@/utils/formatCurrency';
import { formatStatusLabel } from '@/utils/formatLabels';
import { getApiErrorMessage, parseApiEntity } from '@/utils/parseApiListResponse';
import { refreshAfterQuoteChange, refreshAfterQuoteToJob } from '@/utils/queryInvalidation';

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

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { activeTenant } = useAuth();
  const { bg, colors } = useEntityDetailTheme();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [converting, setConverting] = useState(false);

  const isStudio = resolveBusinessType(activeTenant?.businessType) === 'studio';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => quoteService.getQuoteById(String(id)),
    enabled: !!id,
  });

  const quote = useMemo(() => parseApiEntity<QuoteDetail>(data), [data]);

  const handleMarkStatus = useCallback(
    async (newStatus: 'sent' | 'accepted') => {
      if (!quote) return;
      setUpdatingStatus(true);
      try {
        await quoteService.updateStatus(quote.id, newStatus);
        await refetch();
        await refreshAfterQuoteChange(queryClient);
        Alert.alert('Success', `Quote marked as ${formatStatusLabel(newStatus)}`);
      } catch (err: unknown) {
        Alert.alert('Error', getApiErrorMessage(err, 'Failed to update quote status'));
      } finally {
        setUpdatingStatus(false);
      }
    },
    [quote, queryClient, refetch]
  );

  const handleConvertToJob = useCallback(async () => {
    if (!quote) return;
    setConverting(true);
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
    } finally {
      setConverting(false);
    }
  }, [quote, queryClient]);

  if (isLoading) return <DetailLoading title="Quote" />;
  if (!quote) return <DetailNotFound title="Quote" entityLabel="Quote" />;

  return (
    <>
      <EntityDetailHeader title={quote.quoteNumber || 'Quote details'} />
      <ScreenShell style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <DetailCard>
            <DetailRow label="Title" value={quote.title} />
            <DetailRow label="Total" value={formatCurrency(quote.totalAmount)} valueColor={colors.tint} />
            <DetailRow label="Customer" value={quote.customer?.name ?? '—'} />
            <DetailRow label="Status" value={formatStatusLabel(quote.status)} />
            {quote.validUntil ? <DetailRow label="Valid Until" value={formatDate(quote.validUntil)} /> : null}
            <DetailRow label="Created" value={formatDate(quote.createdAt)} />
          </DetailCard>
          {quote.items && quote.items.length > 0 ? (
            <DetailCard>
              <Text style={styles.section}>Items</Text>
              {quote.items.map((item, i) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.description} x{item.quantity}
                  </Text>
                  <Text style={styles.itemTotal}>
                    {formatCurrency(item.total || item.unitPrice * item.quantity)}
                  </Text>
                </View>
              ))}
            </DetailCard>
          ) : null}
        </ScrollView>
        <DetailFooter>
          {quote.status === 'draft' ? (
            <DetailActionButton
              label={updatingStatus ? 'Updating…' : 'Mark as sent'}
              onPress={() => handleMarkStatus('sent')}
              disabled={updatingStatus || converting}
            />
          ) : null}
          {quote.status === 'sent' ? (
            <DetailActionButton
              label={updatingStatus ? 'Updating…' : 'Mark accepted'}
              onPress={() => handleMarkStatus('accepted')}
              disabled={updatingStatus || converting}
            />
          ) : null}
          {isStudio && quote.status !== 'declined' && quote.status !== 'expired' ? (
            <DetailActionButton
              label={converting ? 'Converting…' : 'Convert to job'}
              variant="primary"
              onPress={handleConvertToJob}
              disabled={converting || updatingStatus}
            />
          ) : null}
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
