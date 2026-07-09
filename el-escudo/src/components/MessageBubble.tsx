import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  ViewStyle,
} from 'react-native';
import { Message } from '../types';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';

// ─── XP Badge ────────────────────────────────────────────────────────────────

/**
 * Props for the XPBadge component.
 */
interface XPBadgeProps {
  /** Amount of XP earned to display. */
  amount: number;
  /** Optional label shown after the XP amount (e.g., action description). */
  label?: string;
}

/**
 * XPBadge — Animated badge showing earned XP with spring entrance.
 *
 * @component
 * @param {XPBadgeProps} props - Component props
 * @param {number} props.amount - XP amount to display
 * @param {string} [props.label] - Optional action label
 */
const XPBadge: React.FC<XPBadgeProps> = ({ amount, label }) => {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.xpBadge, { transform: [{ scale }], opacity }]}>
      <Text style={styles.xpBadgeIcon}>◆</Text>
      <Text style={styles.xpBadgeText}>
        +{amount} XP{label ? <Text style={styles.xpBadgeLabel}> · {label}</Text> : null}
      </Text>
    </Animated.View>
  );
};

// ─── Level Up Banner ──────────────────────────────────────────────────────────

/**
 * Props for the LevelUpBanner component.
 */
interface LevelUpBannerProps {
  /** The new level the user has reached. */
  newLevel: number;
  /** Optional rank title shown after the level number. */
  title?: string;
}

/**
 * LevelUpBanner — Animated banner celebrating a level-up event.
 *
 * Slides in from below with a fade animation to notify the user of their new level.
 *
 * @component
 * @param {LevelUpBannerProps} props - Component props
 * @param {number} props.newLevel - New level reached
 * @param {string} [props.title] - Optional rank title
 */
const LevelUpBanner: React.FC<LevelUpBannerProps> = ({ newLevel, title }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(translateY,  { toValue: 0, useNativeDriver: Platform.OS !== 'web', tension: 60 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.levelUpBanner, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.levelUpIcon}>⬡</Text>
      <Text style={styles.levelUpText}>
        Nivel {newLevel}{title ? <Text style={styles.levelUpTitle}> — {title}</Text> : null}
      </Text>
    </Animated.View>
  );
};

// ─── Message Bubble ───────────────────────────────────────────────────────────

/**
 * Props for the MessageBubble component.
 */
interface MessageBubbleProps {
  /** Message object containing sender, text, and optional metadata. */
  message: Message;
}

/** Platform-specific glassmorphism styles for web backdrops. */
const glassWeb = Platform.select({
  web: { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as any,
  default: {},
});

/**
 * MessageBubble — Animated chat message bubble with glassmorphic styling.
 *
 * Renders a single message with fade-in and slide-up entrance animation.
 * User messages align right with a solid background; AI messages align left
 * with a translucent glass effect.
 *
 * @component
 * @param {MessageBubbleProps} props - Component props
 * @param {Message} props.message - Message data object
 * @example
 * ```tsx
 * <MessageBubble message={{ id: '1', sender: 'ai', text: 'Comando ejecutado.' }} />
 * ```
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 280, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(translateY, { toValue: 0, tension: 70, friction: 10, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, []);

  const timestamp = message.timestamp.toLocaleTimeString('es-MX', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const bubbleContainerStyle: ViewStyle = isUser
    ? styles.containerUser
    : styles.containerSystem;

  return (
    <Animated.View
      style={[
        styles.root,
        isUser ? styles.rootUser : styles.rootSystem,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {/* ── USER bubble ─────────────────────────── */}
      {isUser && (
        <View style={[styles.bubble, styles.bubbleUser, glassWeb]}>
          <Text style={styles.messageTextUser}>{message.text}</Text>
          <Text style={styles.timestampUser}>{timestamp}</Text>
        </View>
      )}

      {/* ── SYSTEM bubble ───────────────────────── */}
      {!isUser && (
        <View style={styles.systemWrapper}>
          {/* Accent line */}
          <View style={styles.systemAccentLine} />
          <View style={[styles.bubble, styles.bubbleSystem, glassWeb]}>
            {/* System label */}
            <View style={styles.systemHeader}>
              <View style={styles.systemDot} />
              <Text style={styles.systemLabel}>NAVIR</Text>
              <Text style={styles.timestampSystem}>{timestamp}</Text>
            </View>
            <Text style={styles.messageTextSystem}>{message.text}</Text>

            {/* Rewards */}
            {message.xpReward && (
              <View style={styles.rewardsRow}>
                <XPBadge amount={message.xpReward.amount} label={message.xpReward.label} />
              </View>
            )}
            {message.levelUp && (
              <View style={styles.levelUpRow}>
                <LevelUpBanner newLevel={message.levelUp.newLevel} title={message.levelUp.title} />
              </View>
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    marginVertical:    5,
    paddingHorizontal: Spacing.base,
  },
  rootUser: {
    alignItems: 'flex-end',
  },
  rootSystem: {
    alignItems: 'flex-start',
  },

  bubble: {
    maxWidth:      '82%' as any,
    borderRadius:  BorderRadius.lg,
    paddingVertical:   Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },

  // ── User ──────────────────────────────────
  bubbleUser: {
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderWidth:     1,
    borderColor:     Colors.border.cyan,
  },
  messageTextUser: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.base,
    color:      Colors.text.primary,
    lineHeight: FontSize.base * 1.55,
  },
  timestampUser: {
    fontFamily: FontFamily.mono,
    fontSize:   9,
    color:      Colors.text.muted,
    marginTop:  4,
    textAlign:  'right',
  },

  // ── System ────────────────────────────────
  systemWrapper: {
    flexDirection: 'row',
    alignItems:    'stretch',
    maxWidth:      '88%' as any,
  },
  systemAccentLine: {
    width:           2,
    borderRadius:    BorderRadius.full,
    backgroundColor: Colors.accent.green,
    marginRight:     Spacing.sm,
    boxShadow: '0 0 6px rgba(0, 255, 157, 0.8)',
  },
  bubbleSystem: {
    flex:            1,
    backgroundColor: Colors.bg.card,
    borderWidth:     1,
    borderColor:     Colors.border.subtle,
  },
  systemHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginBottom:  Spacing.xs,
  },
  systemDot: {
    width:           6,
    height:          6,
    borderRadius:    BorderRadius.full,
    backgroundColor: Colors.accent.green,
    boxShadow: '0 0 4px rgba(0, 255, 157, 1)',
  },
  systemLabel: {
    fontFamily:    FontFamily.mono,
    fontSize:      9,
    color:         Colors.accent.green,
    letterSpacing: 2,
    fontWeight:    '700',
    flex:          1,
  },
  timestampSystem: {
    fontFamily: FontFamily.mono,
    fontSize:   9,
    color:      Colors.text.muted,
  },
  messageTextSystem: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.base,
    color:      Colors.text.secondary,
    lineHeight: FontSize.base * 1.6,
  },

  // Rewards
  rewardsRow: {
    marginTop: Spacing.sm,
  },
  levelUpRow: {
    marginTop: Spacing.xs,
  },

  // XP Badge
  xpBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    alignSelf:         'flex-start',
    backgroundColor:   'rgba(0, 255, 157, 0.1)',
    borderWidth:       1,
    borderColor:       Colors.border.green,
    borderRadius:      BorderRadius.full,
    paddingVertical:   3,
    paddingHorizontal: Spacing.sm,
  },
  xpBadgeIcon: {
    fontSize: 9,
    color:    Colors.accent.green,
  },
  xpBadgeText: {
    fontFamily:    FontFamily.mono,
    fontSize:      FontSize.xs,
    color:         Colors.accent.green,
    fontWeight:    '700',
    letterSpacing: 0.3,
  },
  xpBadgeLabel: {
    color:      Colors.text.muted,
    fontWeight: '400',
  },

  // Level Up
  levelUpBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.xs,
    alignSelf:         'flex-start',
    backgroundColor:   'rgba(255, 215, 0, 0.1)',
    borderWidth:       1,
    borderColor:       'rgba(255, 215, 0, 0.4)',
    borderRadius:      BorderRadius.md,
    paddingVertical:   Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  levelUpIcon: {
    fontSize: FontSize.sm,
    color:    Colors.accent.gold,
  },
  levelUpText: {
    fontFamily:    FontFamily.mono,
    fontSize:      FontSize.sm,
    color:         Colors.accent.gold,
    fontWeight:    '700',
    letterSpacing: 1,
  },
  levelUpTitle: {
    fontWeight: '400',
    color:      '#D97706',
  },

  // Legacy container styles (unused but kept for TS)
  containerUser:   {},
  containerSystem: {},
});

export default MessageBubble;
