import { useQuery } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { EmptyState, PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { BRAND } from '@/constants';
import { bookingsApi, ordersApi, type OrderSummary, type ServiceBookingSummary } from '@/services/ordersApi';
import { formatCurrency } from '@/utils/format';

type ActivityItem =
  | { type: 'order'; id: string; createdAt: string; order: OrderSummary }
  | { type: 'booking'; id: string; createdAt: string; booking: ServiceBookingSummary };

export default function OrdersScreen() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list({ limit: 30 }),
    enabled: isAuthenticated,
  });

  const bookingsQuery = useQuery({
    queryKey: ['service-bookings'],
    queryFn: () => bookingsApi.list({ limit: 30 }),
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={BRAND.primary} />
      </Screen>
    );
  }

  if (!isAuthenticated) {
    return (
      <Screen style={styles.center}>
        <EmptyState title="Sign in to view orders" />
        <PrimaryButton label="Sign in" onPress={() => router.push('/login')} />
        <Link href="/track-order" asChild>
          <Pressable style={styles.trackLink}>
            <Text style={styles.trackText}>Track as guest</Text>
          </Pressable>
        </Link>
      </Screen>
    );
  }

  const orders = (data?.data?.orders as OrderSummary[]) || [];
  const bookings = (bookingsQuery.data?.data?.bookings as ServiceBookingSummary[]) || [];
  const activity: ActivityItem[] = [
    ...orders.map((order) => ({ type: 'order' as const, id: `order-${order.id}`, createdAt: order.createdAt, order })),
    ...bookings.map((booking) => ({ type: 'booking' as const, id: `booking-${booking.id}`, createdAt: booking.createdAt, booking })),
  ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const refreshAll = () => {
    refetch();
    bookingsQuery.refetch();
  };

  return (
    <Screen>
      <FlatList
        data={activity}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching || bookingsQuery.isRefetching}
        onRefresh={refreshAll}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={BRAND.primary} style={{ marginTop: 40 }} />
          ) : (
            <EmptyState title="No orders or bookings yet" message="Your purchases and service bookings will appear here." />
          )
        }
        renderItem={({ item }) => {
          if (item.type === 'booking') {
            const booking = item.booking;
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/booking/${booking.id}`)}
              >
                <Text style={styles.badge}>Service booking</Text>
                <Text style={styles.number}>{booking.jobNumber}</Text>
                <Text style={styles.store}>{booking.serviceTitle || booking.title}</Text>
                <Text style={styles.total}>{formatCurrency(booking.total, booking.currency)}</Text>
                <Text style={styles.status}>{booking.paymentStatus || booking.status}</Text>
              </Pressable>
            );
          }
          const order = item.order;
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/order/${order.id}`)}>
              <Text style={styles.badge}>Product order</Text>
              <Text style={styles.number}>{order.saleNumber}</Text>
              <Text style={styles.store}>{order.storeName}</Text>
              <Text style={styles.total}>{formatCurrency(order.total, order.currency)}</Text>
              <Text style={styles.status}>{order.orderStatus || order.status}</Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  number: { fontWeight: '800', color: BRAND.text },
  badge: { alignSelf: 'flex-start', color: BRAND.primary, fontWeight: '800', fontSize: 12, marginBottom: 6 },
  store: { marginTop: 4, color: BRAND.muted },
  total: { marginTop: 8, fontWeight: '700', color: BRAND.primary },
  status: { marginTop: 4, textTransform: 'capitalize', color: BRAND.text },
  trackLink: { marginTop: 12, alignItems: 'center' },
  trackText: { color: BRAND.primary, fontWeight: '600' },
});
