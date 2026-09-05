import React, { useEffect, useState } from 'react';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

const toDigits = (value: string) => value.replace(/\D/g, '').slice(0, 4);

const toTimeString = (digits: string) => {
  if (digits.length !== 4) return '';
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2));
  if (hours > 23 || minutes > 59) return '';
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

export const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
}) => {
  const [digits, setDigits] = useState(() => value.replace(/\D/g, '').slice(0, 4));

  useEffect(() => {
    setDigits(value.replace(/\D/g, '').slice(0, 4));
  }, [value]);

  const handleChange = (nextValue: string) => {
    const nextDigits = toDigits(nextValue);
    setDigits(nextDigits);
    const timeString = toTimeString(nextDigits);
    if (timeString) onChange(timeString);
  };

  const handleBlur = () => {
    if (digits.length === 0) {
      onChange('');
      return;
    }
    const timeString = toTimeString(digits);
    if (timeString) {
      onChange(timeString);
    } else {
      setDigits('');
      onChange('');
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]{4}"
      maxLength={4}
      required={required}
      disabled={disabled}
      value={digits}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
      placeholder="0005"
      aria-label="Time in 24-hour HHmm format"
      className={className}
    />
  );
};

interface UtcDateTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const UtcDateTimeInput: React.FC<UtcDateTimeInputProps> = ({
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
}) => {
  const [date, time] = value ? value.split('T') : ['', ''];
  const timeValue = time ? `${time.slice(0, 2)}:${time.slice(3, 5)}` : '';

  const updateDate = (nextDate: string) => {
    onChange(nextDate ? `${nextDate}T${timeValue || '00:00'}` : '');
  };

  const updateTime = (nextTime: string) => {
    onChange(date && nextTime ? `${date}T${nextTime}` : value);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
      <input
        type="date"
        value={date}
        disabled={disabled}
        required={required}
        onChange={(event) => updateDate(event.target.value)}
        className={className}
      />
      <TimeInput
        value={timeValue}
        onChange={updateTime}
        disabled={disabled}
        required={required}
        className={className}
      />
    </div>
  );
};
