import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import type { WorkShift } from '../../store';

interface WeekDay {
  date: Date;
  dayName: string;
  fullDayName: string;
  dayNumber: number;
  isToday: boolean;
}

interface ScheduleWeekCalendarProps {
  workShifts: WorkShift[];
  selectedWeekDay: WeekDay | null;
  onSelectDay: (day: WeekDay | null) => void;
  onClearSelection: () => void;
}

const getWeekDays = (): WeekDay[] => {
  const today = new Date();
  const currentDay = today.getDay();
  const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));

  const days: WeekDay[] = [];
  const dayNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const fullDayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    days.push({
      date,
      dayName: dayNames[i],
      fullDayName: fullDayNames[i],
      dayNumber: date.getDate(),
      isToday: date.toDateString() === new Date().toDateString(),
    });
  }

  return days;
};

const ScheduleWeekCalendar: React.FC<ScheduleWeekCalendarProps> = ({
  workShifts,
  selectedWeekDay,
  onSelectDay,
  onClearSelection,
}) => {
  const weekDays = useMemo(() => getWeekDays(), []);

  const getShiftsForDay = (fullDayName: string) =>
    workShifts.filter((shift) => shift.day === fullDayName);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ESTA SEMANA</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.weekDaysRow}>
          {weekDays.map((day, index) => {
            const dayShifts = getShiftsForDay(day.fullDayName);
            const hasShift = dayShifts.length > 0;

            return (
              <TouchableOpacity
                key={index}
                onPress={() =>
                  onSelectDay(selectedWeekDay?.date.getTime() === day.date.getTime() ? null : day)
                }
                style={[styles.dayColumn, day.isToday && styles.dayColumnToday]}
              >
                <Text style={[styles.dayName, day.isToday && styles.dayNameToday]}>{day.dayName}</Text>
                <Text style={[styles.dayNumber, day.isToday && styles.dayNumberToday]}>{day.dayNumber}</Text>
                {hasShift ? (
                  <View style={styles.shiftIndicator}>
                    {dayShifts.slice(0, 2).map((shift, i) => (
                      <View key={i} style={styles.shiftBlock}>
                        <Text style={styles.shiftTimeSmall}>{shift.start}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noShiftPlaceholder} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {selectedWeekDay && (
        <View style={styles.selectedDayDetail}>
          <View style={styles.selectedDayHeader}>
            <Text style={styles.selectedDayTitle}>
              {selectedWeekDay.fullDayName} {selectedWeekDay.dayNumber}
            </Text>
            <TouchableOpacity onPress={onClearSelection}>
              <Ionicons name="close" size={18} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          {getShiftsForDay(selectedWeekDay.fullDayName).map((shift, i) => (
            <View key={i} style={styles.selectedDayShift}>
              <Ionicons name="time-outline" size={14} color={Colors.accent.green} />
              <Text style={styles.selectedDayShiftText}>
                {shift.start} - {shift.end}
              </Text>
            </View>
          ))}

          {getShiftsForDay(selectedWeekDay.fullDayName).length === 0 && (
            <Text style={styles.selectedDayNoShift}>Sin turnos</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  weekDaysRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  dayColumn: {
    width: 56,
    height: 96,
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayColumnToday: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.bg.card,
  },
  dayName: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  dayNameToday: {
    color: Colors.accent.cyan,
    fontFamily: FontFamily.techSemi,
  },
  dayNumber: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.lg,
    color: Colors.text.primary,
    marginTop: 4,
  },
  dayNumberToday: {
    color: Colors.accent.cyan,
  },
  shiftIndicator: {
    marginTop: 'auto',
    width: '100%',
    gap: 2,
  },
  shiftBlock: {
    backgroundColor: Colors.accent.green + '25',
    borderRadius: BorderRadius.xs,
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  shiftTimeSmall: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.accent.green,
    textAlign: 'center',
  },
  noShiftPlaceholder: {
    marginTop: 'auto',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border.default,
  },
  selectedDayDetail: {
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedDayTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  selectedDayShift: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent.green + '15',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  selectedDayShiftText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.accent.green,
  },
  selectedDayNoShift: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});

export type { WeekDay };
export default ScheduleWeekCalendar;
