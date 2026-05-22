import React from 'react';
import { Text, TextInput, StyleSheet, type TextInputProps } from 'react-native';

import { useScreenColors } from '@/hooks/useScreenColors';

type FormLabelProps = {
  children: string;
  optional?: boolean;
};

export function FormLabel({ children, optional }: FormLabelProps) {
  const { mutedColor } = useScreenColors();
  return (
    <Text style={[styles.label, { color: mutedColor }]}>
      {children}
      {optional ? ' (optional)' : ''}
    </Text>
  );
}

type FormInputProps = TextInputProps & {
  multiline?: boolean;
};

export function FormInput({ multiline, style, placeholderTextColor, ...props }: FormInputProps) {
  const { textColor, mutedColor, borderColor, inputBg } = useScreenColors();
  return (
    <TextInput
      {...props}
      multiline={multiline}
      placeholderTextColor={placeholderTextColor ?? mutedColor}
      style={[
        styles.input,
        multiline && styles.textArea,
        {
          color: textColor,
          borderColor,
          backgroundColor: inputBg,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
