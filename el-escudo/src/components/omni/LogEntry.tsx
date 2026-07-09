import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { ActionLog } from '../../store';

interface LogEntryProps {
  log: ActionLog;
}

export const LogEntry: React.FC<LogEntryProps> = React.memo(({ log }) => {
  const isUser = log.category === 'NONE' || log.category === 'USUARIO';

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Ionicons name="flash" size={10} color="#000" />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{log.text}</Text>
        <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
          {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
});

export const TypingIndicator: React.FC = () => (
  <View style={[styles.bubbleRow, styles.bubbleRowAI]}>
    <View style={styles.aiAvatar}>
      <Ionicons name="flash" size={10} color="#000" />
    </View>
    <View style={styles.typingBubble}>
      <ActivityIndicator size="small" color={Colors.accent.green} />
      <Text style={styles.typingText}>Pensando contigo...</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubbleRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleRowAI: { alignSelf: 'flex-start' },
  aiAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.accent.green, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble: { maxWidth: '80%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  bubbleUser: { backgroundColor: '#1C1C1F', borderBottomRightRadius: BorderRadius.xs },
  bubbleAI: { backgroundColor: 'rgba(0, 255, 157, 0.04)', borderWidth: 1, borderColor: Colors.accent.green + '15', borderBottomLeftRadius: BorderRadius.xs },
  bubbleText: { fontFamily: FontFamily.techRegular, fontSize: FontSize.sm, color: Colors.text.primary, lineHeight: 20 },
  bubbleTextUser: { color: '#E5E5E7' },
  bubbleTime: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, marginTop: 4, opacity: 0.5 },
  bubbleTimeUser: { textAlign: 'right' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0, 255, 157, 0.04)', borderWidth: 1, borderColor: Colors.accent.green + '15', borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  typingText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.accent.green, opacity: 0.6 },
});
