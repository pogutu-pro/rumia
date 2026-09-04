import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { palette, radii } from './theme';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <AlertTriangle size={26} color={palette.amber[700]} />
          </View>
          <Text style={styles.title}>Oops, something went wrong</Text>
          <Text style={styles.message} numberOfLines={6}>
            {this.state.error.message}
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => this.setState({ error: null })}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: palette.white },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.amber[50],
    borderWidth: 1,
    borderColor: palette.amber[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: palette.slate[900], fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message: { color: palette.slate[500], fontSize: 13, textAlign: 'center', marginBottom: 24, maxWidth: 300 },
  button: { backgroundColor: palette.slate[900], paddingHorizontal: 24, paddingVertical: 12, borderRadius: radii.xl },
  buttonText: { color: palette.white, fontWeight: '700', fontSize: 14 },
});