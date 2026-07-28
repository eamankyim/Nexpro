import { Redirect } from 'expo-router';

/**
 * Legacy Online Orders route — orders now live under Online Store → Orders.
 */
export default function OnlineOrdersRedirect() {
  return <Redirect href={'/(tabs)/store?section=orders' as never} />;
}
