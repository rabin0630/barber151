import { setupPhoneNumberInput } from './phoneNumber.ts';

/** 入力欄のお名前 */
const name: HTMLInputElement = document.getElementById('customer-name') as HTMLInputElement;
/** 入力欄のInstagramアカウント名 */
const instagram: HTMLInputElement = document.getElementById('customer-instagram') as HTMLInputElement;
/** 入力欄の電話番号 */
const phone: HTMLInputElement = document.getElementById('customer-phone') as HTMLInputElement;
setupPhoneNumberInput(phone);





export { name, instagram, phone }