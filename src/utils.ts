import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

export const formatDate = (timestamp: Timestamp | Date | null) => {
  if (!timestamp) return '-';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return format(date, 'd MMMM yyyy', { locale: th });
};

export const formatDateTime = (timestamp: Timestamp | Date | null) => {
  if (!timestamp) return '-';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return format(date, 'd MMMM yyyy HH:mm', { locale: th });
};

export const formatInstructorName = (name: string) => {
  if (!name) return '';
  const trimmedName = name.trim();
  
  // Regex for academic titles and military/police ranks
  // Covers: ผศ., รศ., ดร., ศ., พล., พ., ร., น., จ., ส., ด.ต., ว่าที่
  const titleRegex = /^(ผศ\.|รศ\.|ดร\.|ศ\.|พล\.|พ\.|ร\.|น\.|จ\.|ส\.|ด\.ต\.|ว่าที่)/;
  
  if (titleRegex.test(trimmedName)) {
    return trimmedName;
  }
  
  // Remove common prefixes if they exist before adding "อ."
  let cleanName = trimmedName;
  const commonPrefixes = ['นาย', 'นางสาว', 'นาง'];
  for (const prefix of commonPrefixes) {
    if (cleanName.startsWith(prefix)) {
      cleanName = cleanName.substring(prefix.length).trim();
      break;
    }
  }
  
  return `อ.${cleanName}`;
};
