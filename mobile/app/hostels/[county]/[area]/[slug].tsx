import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

export default function HostelDeepLinkScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string; county?: string; area?: string }>();

  if (!slug) {
    return <Redirect href="/explore" />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Redirect href={`/listing/${slug}`} />
    </>
  );
}