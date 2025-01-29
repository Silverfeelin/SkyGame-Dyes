import { Pipe, PipeTransform } from '@angular/core';
import { DateTime } from 'luxon';

@Pipe({
    name: 'datetime',
    standalone: true
})
export class DateTimePipe implements PipeTransform {
  transform(date: DateTime, format: string): string {
    return date.toFormat(format);
  }
}
