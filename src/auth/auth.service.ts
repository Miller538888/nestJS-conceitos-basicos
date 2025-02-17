import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { User } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { UserService } from "src/user/user.service";
import { AuthRegisterDTO } from "./dto/auth-register.dto";
import * as bcrypt from 'bcrypt';
import { MailerService } from "@nestjs-modules/mailer";

@Injectable()
export class AuthService{

    constructor(
        private readonly jwtService: JwtService, 
        private readonly prisma: PrismaService,
        private readonly userService: UserService,
        private readonly mailer : MailerService
    ) {}

    createToken(user:User){
        return {
                acess_token : this.jwtService.sign({
                id: user.id,
                name: user.name,
                email: user.email
            }, {
                subject: String(user.id),
                issuer: 'login',
                audience: 'users'
            })
        }
    }

    checkToken(token : string){
        try {
            const data = this.jwtService.verify(token, {})

            return data
        } catch (error) {
            throw new BadRequestException(error);
        }
    }

    validToken(token : string){
        try {
            this.jwtService.verify(token, {})
            return true
        } catch (error) {
            return false
        }
    }

    async login(email: string, password:string)
    {

        const user = await this.prisma.user.findFirst({
            where: {
                email
            }
        });

        if(!user)
        {
            throw new UnauthorizedException('E-mail e/ou senha incorretos.')
        }

        if(!await bcrypt.compare(password, user.password))
        {
            throw new UnauthorizedException('E-mail e/ou senha incorretos.')
        }

        return this.createToken(user);

    }

    async forget(email: string)
    {
        const user = await this.prisma.user.findFirst({
            where: {
                email
            }
        });

        if(!user)
        {
            throw new UnauthorizedException('E-mail está incorreto.')
        }

        const token = this.jwtService.sign({
            id: user.id
        },{
            expiresIn: '30 minutes',
            subject: String(user.id),
            issuer: 'forget',
            audience: 'users'
        })

        await this.mailer.sendMail({
            subject: 'Recuperação de Senha',
            to: 'millerfernandes53@gmail.com',
            template: 'forget.pug',
            context: {
                name: user.name,
                token
            }
        })

        return {'sucess' : true};
    }

    async reset(password:string, token:string){

        try {
            const data:any = this.jwtService.verify(token, {
                issuer: 'forget',
                audience: 'users'
            })

            if(isNaN(Number(data.id)))
            {
                throw new BadRequestException('Token Inválido')
            }

            const salt = await bcrypt.genSalt()
            password  = await bcrypt.hash(password, salt)

            const id = data.id;

            const user = await this.prisma.user.update({
                where:{
                    id
                }, 
                data: {
                    password
                }
            })

            return this.createToken(user);

        } catch (error) {
            throw new BadRequestException(error)
        }

    }

    async register(data: AuthRegisterDTO)
    {
        const user = await this.userService.create(data)
        return this.createToken(user);
    }

}