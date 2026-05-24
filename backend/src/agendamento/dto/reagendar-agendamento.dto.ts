import { IsDateString, IsString, Matches } from 'class-validator';

export class ReagendarAgendamentoDto {
  @IsDateString()
  data!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'A hora deve estar no formato HH:mm' })
  hora!: string;
}
