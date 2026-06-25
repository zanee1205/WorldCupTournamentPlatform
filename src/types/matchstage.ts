export type MatchStage =
  | 'group' //vòng loại
  | 'round_of_32' //vòng 1/16
  | 'round_of_16' //vòng 1/8
  | 'quarterfinal' //vòng tứ kết
  | 'semifinal' //vòng bán kết
  | 'third_place' //tranh hạng ba
  | 'final';    //chung kết