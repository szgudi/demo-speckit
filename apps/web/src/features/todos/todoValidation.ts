export function validateTitle(value:string):string|null { const title=value.trim(); if(!title)return '标题不能为空'; if(title.length>200)return '标题不能超过 200 个字符'; return null; }
