import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import {
  DetailCard,
  DetailLoading,
  DetailNotFound,
  DetailRow,
  EntityDetailHeader,
  useEntityDetailTheme,
} from '@/components/EntityDetailLayout';
import { ScreenShell } from '@/components/ScreenShell';
import { expenseService } from '@/services/expenseService';
import { formatCurrency, formatDate } from '@/utils/formatCurrency';
import { parseApiEntity } from '@/utils/parseApiListResponse';

type ExpenseDetail = {
  id: string;
  description?: string;
  amount: number;
  category?: string;
  expenseDate?: string;
  date?: string;
  paymentMethod?: string;
  notes?: string;
  categoryObj?: { name?: string };
};

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bg, colors } = useEntityDetailTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => expenseService.getExpenseById(String(id)),
    enabled: !!id,
  });

  const expense = useMemo(() => parseApiEntity<ExpenseDetail>(data), [data]);

  if (isLoading) return <DetailLoading title="Expense" />;
  if (!expense) return <DetailNotFound title="Expense" entityLabel="Expense" />;

  const categoryLabel =
    typeof expense.category === 'string' ? expense.category : expense.categoryObj?.name;

  return (
    <>
      <EntityDetailHeader title={expense.description || 'Expense'} />
      <ScreenShell style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <DetailCard>
            {expense.description ? (
              <DetailRow label="Description" value={expense.description} />
            ) : null}
            <DetailRow label="Amount" value={formatCurrency(expense.amount)} valueColor="#ef4444" />
            {categoryLabel ? <DetailRow label="Category" value={categoryLabel} /> : null}
            <DetailRow
              label="Expense Date"
              value={formatDate(expense.expenseDate ?? expense.date)}
            />
            {expense.paymentMethod ? (
              <DetailRow label="Payment Method" value={expense.paymentMethod.replace(/_/g, ' ')} />
            ) : null}
            {expense.notes ? <DetailRow label="Notes" value={expense.notes} /> : null}
          </DetailCard>
        </ScrollView>
      </ScreenShell>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16 },
});
